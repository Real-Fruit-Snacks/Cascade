use std::collections::HashSet;
use std::path::PathBuf;
use walkdir::WalkDir;
use regex::Regex;
use tauri::State;

use crate::error::CascadeError;
use crate::fts::FtsState;

#[derive(serde::Serialize, Clone, Debug)]
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

#[derive(serde::Serialize, Clone, Debug)]
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

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    // Helper: build a temp vault with specific files and return (TempDir, PathBuf).
    // We create a non-dotfile subdirectory "vault" inside the tempdir so that
    // WalkDir's dotfile filter (which prunes entries starting with '.') does not
    // prune the vault root itself (Windows tempfile names begin with ".tmp...").
    fn make_vault_with_files(files: &[(&str, &str)]) -> (tempfile::TempDir, PathBuf) {
        let dir = tempfile::tempdir().expect("failed to create temp dir");
        let vault = dir.path().join("vault");
        fs::create_dir_all(&vault).unwrap();
        let root = vault.canonicalize().unwrap();
        for (rel, content) in files {
            let abs = root.join(rel.replace('/', std::path::MAIN_SEPARATOR_STR));
            if let Some(parent) = abs.parent() {
                fs::create_dir_all(parent).unwrap();
            }
            fs::write(&abs, content).unwrap();
        }
        (dir, root)
    }

    // --- Matcher unit tests ---

    #[test]
    fn test_plain_matcher_case_insensitive() {
        let m = Matcher::Plain { query: "hello".to_string(), case_sensitive: false };
        assert!(m.is_match("Hello World"));
        assert!(m.is_match("say hello there"));
        assert!(!m.is_match("world"));
    }

    #[test]
    fn test_plain_matcher_case_sensitive() {
        let m = Matcher::Plain { query: "Hello".to_string(), case_sensitive: true };
        assert!(m.is_match("Hello World"));
        assert!(!m.is_match("hello world"));
    }

    #[test]
    fn test_regex_matcher_basic() {
        let re = regex::Regex::new(r"\bfoo\b").unwrap();
        let m = Matcher::Re(re);
        assert!(m.is_match("foo bar"));
        assert!(!m.is_match("foobar"));
    }

    #[test]
    fn test_regex_matcher_case_insensitive() {
        let re = regex::Regex::new(r"(?i)rust").unwrap();
        let m = Matcher::Re(re);
        assert!(m.is_match("Rust programming"));
        assert!(m.is_match("RUST"));
        assert!(!m.is_match("python"));
    }

    // --- scan_file_lines tests ---

    #[test]
    fn test_scan_file_lines_finds_matches() {
        let m = Matcher::Plain { query: "todo".to_string(), case_sensitive: false };
        let content = "Line one\ntodo: fix this\nLine three\ntodo: and this";
        let mut matches: Vec<SearchMatch> = Vec::new();
        scan_file_lines(&m, "notes/a.md", content, &mut matches);
        assert_eq!(matches.len(), 2);
        assert_eq!(matches[0].line_number, 2);
        assert_eq!(matches[1].line_number, 4);
        assert_eq!(matches[0].file_path, "notes/a.md");
    }

    #[test]
    fn test_scan_file_lines_no_matches() {
        let m = Matcher::Plain { query: "xyz".to_string(), case_sensitive: false };
        let content = "hello world\nfoo bar";
        let mut matches: Vec<SearchMatch> = Vec::new();
        scan_file_lines(&m, "a.md", content, &mut matches);
        assert!(matches.is_empty());
    }

    #[test]
    fn test_scan_file_lines_trims_whitespace() {
        let m = Matcher::Plain { query: "trim".to_string(), case_sensitive: false };
        let content = "   trim this   ";
        let mut matches: Vec<SearchMatch> = Vec::new();
        scan_file_lines(&m, "a.md", content, &mut matches);
        assert_eq!(matches.len(), 1);
        assert_eq!(matches[0].line_text, "trim this");
    }

    #[test]
    fn test_scan_file_lines_respects_200_limit() {
        let m = Matcher::Plain { query: "x".to_string(), case_sensitive: false };
        // 210 lines all matching
        let content = (0..210).map(|_| "x").collect::<Vec<_>>().join("\n");
        let mut matches: Vec<SearchMatch> = Vec::new();
        // Pre-fill to 199 to test the cap triggers inside scan_file_lines at 200
        for i in 0..199 {
            matches.push(SearchMatch {
                file_path: "pre.md".to_string(),
                line_number: i + 1,
                line_text: "x".to_string(),
            });
        }
        scan_file_lines(&m, "a.md", &content, &mut matches);
        assert_eq!(matches.len(), 200);
    }

    // --- search_vault_sync integration tests ---

    #[test]
    fn test_search_vault_sync_plain() {
        let (_dir, root) = make_vault_with_files(&[
            ("notes/a.md", "hello world\nsecond line"),
            ("notes/b.md", "goodbye world"),
        ]);
        let results = search_vault_sync(root, "hello".to_string(), false, false, false, None).unwrap();
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].line_number, 1);
    }

    #[test]
    fn test_search_vault_sync_case_sensitive() {
        let (_dir, root) = make_vault_with_files(&[("note.md", "Hello World\nhello lower")]);
        let results = search_vault_sync(root.clone(), "Hello".to_string(), false, true, false, None).unwrap();
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].line_number, 1);
    }

    #[test]
    fn test_search_vault_sync_case_insensitive() {
        let (_dir, root) = make_vault_with_files(&[("note.md", "Hello World\nhello lower")]);
        let results = search_vault_sync(root.clone(), "hello".to_string(), false, false, false, None).unwrap();
        assert_eq!(results.len(), 2);
    }

    #[test]
    fn test_search_vault_sync_regex() {
        let (_dir, root) = make_vault_with_files(&[("note.md", "foo123\nbar456\nfoo789")]);
        let results = search_vault_sync(root, r"foo\d+".to_string(), true, true, false, None).unwrap();
        assert_eq!(results.len(), 2);
    }

    #[test]
    fn test_search_vault_sync_invalid_regex_returns_error() {
        let (_dir, root) = make_vault_with_files(&[("note.md", "content")]);
        let result = search_vault_sync(root, "[invalid".to_string(), true, true, false, None);
        assert!(result.is_err());
        match result.unwrap_err() {
            CascadeError::InvalidRegex(_) => {}
            other => panic!("expected InvalidRegex, got: {:?}", other),
        }
    }

    #[test]
    fn test_search_vault_sync_whole_word() {
        let (_dir, root) = make_vault_with_files(&[("note.md", "foobar\nfoo bar\nfoo")]);
        let results = search_vault_sync(root, "foo".to_string(), false, true, true, None).unwrap();
        // "foobar" should NOT match; "foo bar" and "foo" should
        assert_eq!(results.len(), 2);
        let line_nums: Vec<usize> = results.iter().map(|m| m.line_number).collect();
        assert!(line_nums.contains(&2));
        assert!(line_nums.contains(&3));
    }

    #[test]
    fn test_search_vault_sync_skips_non_md_files() {
        let (_dir, root) = make_vault_with_files(&[
            ("note.md", "findme"),
            ("image.png", "findme"),
            ("data.txt", "findme"),
        ]);
        let results = search_vault_sync(root, "findme".to_string(), false, true, false, None).unwrap();
        // Only the .md file should be scanned
        assert_eq!(results.len(), 1);
        assert!(results[0].file_path.ends_with(".md"));
    }

    // --- replace_in_files_sync tests ---

    #[test]
    fn test_replace_plain_text() {
        let (_dir, root) = make_vault_with_files(&[("note.md", "hello world\nhello again")]);
        let result = replace_in_files_sync(
            root.clone(),
            "hello".to_string(),
            "goodbye".to_string(),
            vec!["note.md".to_string()],
            false,
            true,
        ).unwrap();
        assert_eq!(result.files_changed, 1);
        assert_eq!(result.total_replacements, 2);
        let content = fs::read_to_string(root.join("note.md")).unwrap();
        assert_eq!(content, "goodbye world\ngoodbye again");
    }

    #[test]
    fn test_replace_with_regex() {
        let (_dir, root) = make_vault_with_files(&[("note.md", "foo123 bar456")]);
        let result = replace_in_files_sync(
            root.clone(),
            r"\d+".to_string(),
            "NUM".to_string(),
            vec!["note.md".to_string()],
            true,
            true,
        ).unwrap();
        assert_eq!(result.total_replacements, 2);
        let content = fs::read_to_string(root.join("note.md")).unwrap();
        assert_eq!(content, "fooNUM barNUM");
    }

    #[test]
    fn test_replace_case_insensitive() {
        let (_dir, root) = make_vault_with_files(&[("note.md", "Hello HELLO hello")]);
        let result = replace_in_files_sync(
            root.clone(),
            "hello".to_string(),
            "hi".to_string(),
            vec!["note.md".to_string()],
            false,
            false,
        ).unwrap();
        assert_eq!(result.total_replacements, 3);
        let content = fs::read_to_string(root.join("note.md")).unwrap();
        assert_eq!(content, "hi hi hi");
    }

    #[test]
    fn test_replace_no_match_no_change() {
        let (_dir, root) = make_vault_with_files(&[("note.md", "original content")]);
        let result = replace_in_files_sync(
            root.clone(),
            "notfound".to_string(),
            "replacement".to_string(),
            vec!["note.md".to_string()],
            false,
            true,
        ).unwrap();
        assert_eq!(result.files_changed, 0);
        assert_eq!(result.total_replacements, 0);
    }

    #[test]
    fn test_replace_invalid_regex_returns_error() {
        let (_dir, root) = make_vault_with_files(&[("note.md", "content")]);
        let result = replace_in_files_sync(
            root,
            "[bad".to_string(),
            "x".to_string(),
            vec!["note.md".to_string()],
            true,
            true,
        );
        assert!(result.is_err());
        match result.unwrap_err() {
            CascadeError::InvalidRegex(_) => {}
            other => panic!("expected InvalidRegex, got: {:?}", other),
        }
    }
}
