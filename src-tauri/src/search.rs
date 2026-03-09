use std::collections::HashSet;
use std::path::PathBuf;
use walkdir::WalkDir;
use regex::Regex;
use tauri::State;

use crate::error::CascadeError;
use crate::fts::FtsState;

#[derive(serde::Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SearchMatch {
    pub file_path: String,
    pub line_number: usize,
    pub line_text: String,
}

enum Matcher {
    Plain { query: String, case_sensitive: bool },
    Re(Regex),
}

impl Matcher {
    fn is_match(&self, line: &str) -> bool {
        match self {
            Matcher::Plain { query, case_sensitive } => {
                if *case_sensitive {
                    line.contains(query.as_str())
                } else {
                    line.to_ascii_lowercase().contains(query.as_str())
                }
            }
            Matcher::Re(re) => re.is_match(line),
        }
    }
}

#[tauri::command]
pub async fn search_vault(
    vault_root: String,
    query: String,
    use_regex: bool,
    case_sensitive: bool,
    whole_word: bool,
    fts_state: State<'_, FtsState>,
) -> Result<Vec<SearchMatch>, CascadeError> {
    if query.is_empty() {
        return Ok(vec![]);
    }

    let root = PathBuf::from(&vault_root)
        .canonicalize()
        .map_err(|_| CascadeError::NotADirectory(vault_root.clone()))?;
    if !root.is_dir() {
        return Err(CascadeError::NotADirectory(vault_root));
    }

    // Extract FTS candidates BEFORE spawn_blocking (State cannot cross thread boundary)
    // Use FTS for plain-text and whole-word queries (same search terms, just stricter matching later)
    let fts_candidates: Option<HashSet<String>> = if !use_regex {
        let guard = fts_state.0.lock().unwrap_or_else(|e| e.into_inner());
        if let Some(ref conn) = *guard {
            crate::fts::search_fts(conn, &query).map(|paths| paths.into_iter().collect())
        } else {
            None
        }
    } else {
        None
    };

    tauri::async_runtime::spawn_blocking(move || {
        search_vault_sync(root, query, use_regex, case_sensitive, whole_word, fts_candidates)
    })
    .await
    .map_err(|e| CascadeError::Io(std::io::Error::other(e.to_string())))?
}

fn search_vault_sync(
    root: PathBuf,
    query: String,
    use_regex: bool,
    case_sensitive: bool,
    whole_word: bool,
    fts_candidates: Option<HashSet<String>>,
) -> Result<Vec<SearchMatch>, CascadeError> {
    // Build matcher
    let matcher = if use_regex {
        let base = if whole_word {
            format!(r"\b{}\b", query)
        } else {
            query.clone()
        };
        let pattern = if case_sensitive { base } else { format!("(?i){}", base) };
        match Regex::new(&pattern) {
            Ok(re) => Matcher::Re(re),
            Err(e) => return Err(CascadeError::InvalidRegex(e.to_string())),
        }
    } else if whole_word {
        let escaped = regex::escape(&query);
        let base = format!(r"\b{}\b", escaped);
        let pattern = if case_sensitive { base } else { format!("(?i){}", base) };
        match Regex::new(&pattern) {
            Ok(re) => Matcher::Re(re),
            Err(e) => return Err(CascadeError::InvalidRegex(e.to_string())),
        }
    } else {
        Matcher::Plain {
            query: if case_sensitive { query.clone() } else { query.to_lowercase() },
            case_sensitive,
        }
    };

    let mut matches: Vec<SearchMatch> = Vec::new();

    // If FTS gave us candidates, only scan those files
    if let Some(ref candidates) = fts_candidates {
        for rel_path in candidates {
            let abs_path = root.join(rel_path.replace('/', std::path::MAIN_SEPARATOR_STR));
            let content = match std::fs::read_to_string(&abs_path) {
                Ok(c) => c,
                Err(_) => continue,
            };
            scan_file_lines(&matcher, rel_path, &content, &mut matches);
            if matches.len() >= 200 {
                return Ok(matches);
            }
        }
        return Ok(matches);
    }

    // Fallback: full vault scan
    for entry in WalkDir::new(&root)
        .follow_links(false)
        .into_iter()
        .filter_entry(|e| !e.file_name().to_string_lossy().starts_with('.'))
        .filter_map(|e| e.ok())
    {
        if !entry.file_type().is_file() {
            continue;
        }

        let path = entry.path();
        match path.extension().and_then(|e| e.to_str()) {
            Some("md") => {}
            _ => continue,
        }

        let rel_path = path
            .strip_prefix(&root)
            .unwrap_or(path)
            .to_string_lossy()
            .replace('\\', "/");

        let content = match std::fs::read_to_string(path) {
            Ok(c) => c,
            Err(_) => continue,
        };

        scan_file_lines(&matcher, &rel_path, &content, &mut matches);
        if matches.len() >= 200 {
            return Ok(matches);
        }
    }

    Ok(matches)
}

fn scan_file_lines(
    matcher: &Matcher,
    rel_path: &str,
    content: &str,
    matches: &mut Vec<SearchMatch>,
) {
    for (idx, line) in content.lines().enumerate() {
        if matcher.is_match(line) {
            matches.push(SearchMatch {
                file_path: rel_path.to_string(),
                line_number: idx + 1,
                line_text: line.trim().to_string(),
            });
            if matches.len() >= 200 {
                return;
            }
        }
    }
}

#[derive(serde::Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ReplaceResult {
    pub files_changed: usize,
    pub total_replacements: usize,
}

#[tauri::command]
pub async fn replace_in_files(
    vault_root: String,
    query: String,
    replacement: String,
    file_paths: Vec<String>,
    use_regex: bool,
    case_sensitive: bool,
) -> Result<ReplaceResult, CascadeError> {
    if query.is_empty() {
        return Ok(ReplaceResult { files_changed: 0, total_replacements: 0 });
    }

    let root = PathBuf::from(&vault_root)
        .canonicalize()
        .map_err(|_| CascadeError::NotADirectory(vault_root.clone()))?;
    if !root.is_dir() {
        return Err(CascadeError::NotADirectory(vault_root));
    }

    tauri::async_runtime::spawn_blocking(move || {
        replace_in_files_sync(root, query, replacement, file_paths, use_regex, case_sensitive)
    })
    .await
    .map_err(|e| CascadeError::Io(std::io::Error::other(e.to_string())))?
}

fn replace_in_files_sync(
    root: PathBuf,
    query: String,
    replacement: String,
    file_paths: Vec<String>,
    use_regex: bool,
    case_sensitive: bool,
) -> Result<ReplaceResult, CascadeError> {
    let re = if use_regex {
        let pattern = if case_sensitive { query.clone() } else { format!("(?i){}", query) };
        match Regex::new(&pattern) {
            Ok(r) => r,
            Err(e) => return Err(CascadeError::InvalidRegex(e.to_string())),
        }
    } else {
        let escaped = regex::escape(&query);
        let pattern = if case_sensitive { escaped } else { format!("(?i){}", escaped) };
        Regex::new(&pattern).map_err(|e| CascadeError::InvalidRegex(e.to_string()))?
    };

    let mut files_changed = 0usize;
    let mut total_replacements = 0usize;

    for file_path in &file_paths {
        let abs_path = crate::vault::validate_path_canonical(&root, file_path)?;

        let content = match std::fs::read_to_string(&abs_path) {
            Ok(c) => c,
            Err(_) => continue,
        };

        let mut count = 0usize;
        let replaced_cow: std::borrow::Cow<str> = if use_regex {
            re.replace_all(&content, |caps: &regex::Captures| {
                count += 1;
                let mut expanded = String::new();
                caps.expand(replacement.as_str(), &mut expanded);
                expanded
            })
        } else {
            re.replace_all(&content, |_caps: &regex::Captures| {
                count += 1;
                replacement.as_str()
            })
        };
        if count > 0 {
            let replaced = replaced_cow.as_ref();
            if replaced.len() > content.len() * 10 + 1024 {
                return Err(CascadeError::InvalidPath(
                    "replacement would produce excessively large output".to_string(),
                ));
            }
            std::fs::write(&abs_path, replaced.as_bytes())
                .map_err(CascadeError::Io)?;
            files_changed += 1;
            total_replacements += count;
        }
    }

    Ok(ReplaceResult { files_changed, total_replacements })
}
