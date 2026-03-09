use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::LazyLock;

use regex::Regex;
use tauri::State;
use walkdir::WalkDir;

use crate::error::CascadeError;
use crate::fts::{self, FtsState};

static INLINE_TAG_RE: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"(?:^|\s)#([a-zA-Z][\w\-/]*)").unwrap());
static WIKI_LINK_RE: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"\[\[([^\]|]+?)(?:\|[^\]]+?)?\]\]").unwrap());
pub static FRONTMATTER_RE: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"(?s)\A---\r?\n(.*?)\r?\n---").unwrap());
static FM_INLINE_RE: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"(?m)^(?:tags|categories|keywords)\s*:\s*\[([^\]]*)\]").unwrap());
static FM_LIST_RE: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"(?m)^(?:tags|categories|keywords)\s*:\s*\r?\n((?:\s+-\s+.+\r?\n?)*)").unwrap());
static FM_LIST_ITEM_RE: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"(?m)^\s+-\s+(.+)").unwrap());

#[derive(serde::Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct FileProperties {
    pub path: String,
    pub properties: HashMap<String, PropertyValue>,
}

#[derive(serde::Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
#[serde(untagged)]
pub enum PropertyValue {
    Bool(bool),
    Number(f64),
    Text(String),
    List(Vec<String>),
}

#[derive(serde::Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct VaultIndex {
    /// Map of tag (lowercase, no #) -> list of file paths containing it
    pub tag_index: HashMap<String, Vec<String>>,
    /// Map of link target (lowercase, no .md) -> list of file paths linking to it
    pub backlink_index: HashMap<String, Vec<String>>,
    /// Frontmatter properties for each file
    pub property_index: Vec<FileProperties>,
}

/// Parse all key-value properties from a YAML frontmatter block.
/// Skips tags/categories/keywords keys (handled by tag indexing).
pub fn parse_frontmatter_properties(yaml: &str) -> HashMap<String, PropertyValue> {
    let mut props: HashMap<String, PropertyValue> = HashMap::new();
    let lines: Vec<&str> = yaml.lines().collect();
    let mut i = 0;
    while i < lines.len() {
        let line = lines[i];
        // Match "key: value" or "key:" at start of line (no leading whitespace = top-level key)
        if line.starts_with(' ') || line.starts_with('\t') {
            i += 1;
            continue;
        }
        if let Some(colon_pos) = line.find(':') {
            let key = line[..colon_pos].trim().to_string();
            if key.is_empty() {
                i += 1;
                continue;
            }
            let rest = line[colon_pos + 1..].trim();

            // Check if next lines are list items (rest is empty => block list)
            if rest.is_empty() {
                let mut list_items: Vec<String> = Vec::new();
                let mut j = i + 1;
                while j < lines.len() {
                    let next = lines[j];
                    if next.starts_with("  - ") || next.starts_with("- ") {
                        let item = next
                            .trim_start()
                            .trim_start_matches("- ")
                            .trim()
                            .trim_matches(|c| c == '\'' || c == '"')
                            .to_string();
                        list_items.push(item);
                        j += 1;
                    } else {
                        break;
                    }
                }
                if !list_items.is_empty() {
                    props.insert(key, PropertyValue::List(list_items));
                    i = j;
                    continue;
                }
                // Empty value
                props.insert(key, PropertyValue::Text(String::new()));
                i += 1;
                continue;
            }

            // Inline list: key: [a, b, c]
            if rest.starts_with('[') && rest.ends_with(']') {
                let inner = &rest[1..rest.len() - 1];
                let items: Vec<String> = inner
                    .split(',')
                    .map(|s| s.trim().trim_matches(|c| c == '\'' || c == '"').to_string())
                    .filter(|s| !s.is_empty())
                    .collect();
                props.insert(key, PropertyValue::List(items));
                i += 1;
                continue;
            }

            // Scalar value
            let value_str = rest.trim_matches(|c| c == '\'' || c == '"');
            let value = if value_str.eq_ignore_ascii_case("true") {
                PropertyValue::Bool(true)
            } else if value_str.eq_ignore_ascii_case("false") {
                PropertyValue::Bool(false)
            } else if let Ok(n) = value_str.parse::<f64>() {
                PropertyValue::Number(n)
            } else {
                PropertyValue::Text(value_str.to_string())
            };
            props.insert(key, value);
        }
        i += 1;
    }
    props
}

#[tauri::command]
pub fn build_index(vault_root: String, fts_state: State<'_, FtsState>) -> Result<VaultIndex, CascadeError> {
    let root = PathBuf::from(&vault_root)
        .canonicalize()
        .map_err(|_| CascadeError::NotADirectory(vault_root.clone()))?;
    if !root.is_dir() {
        return Err(CascadeError::NotADirectory(vault_root));
    }

    let mut tag_index: HashMap<String, Vec<String>> = HashMap::new();
    let mut backlink_index: HashMap<String, Vec<String>> = HashMap::new();
    let mut fts_entries: Vec<(String, String)> = Vec::new();
    let mut property_index: Vec<FileProperties> = Vec::new();

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
        if path.extension().and_then(|e| e.to_str()) != Some("md") {
            continue;
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

        fts_entries.push((rel_path.clone(), content.clone()));

        // --- Extract tags and properties ---

        // Frontmatter tags
        if let Some(fm_caps) = FRONTMATTER_RE.captures(&content) {
            let yaml = fm_caps.get(1).unwrap().as_str();

            // Parse all properties
            let properties = parse_frontmatter_properties(yaml);
            property_index.push(FileProperties {
                path: rel_path.clone(),
                properties,
            });

            // Inline format: tags: [a, b, c]
            if let Some(inline_caps) = FM_INLINE_RE.captures(yaml) {
                for item in inline_caps.get(1).unwrap().as_str().split(',') {
                    let t = item.trim().trim_matches(|c| c == '\'' || c == '"');
                    if !t.is_empty() {
                        tag_index
                            .entry(t.to_lowercase())
                            .or_default()
                            .push(rel_path.clone());
                    }
                }
            }

            // List format: tags:\n  - a\n  - b
            if let Some(list_caps) = FM_LIST_RE.captures(yaml) {
                let list_text = list_caps.get(1).unwrap().as_str();
                for item_caps in FM_LIST_ITEM_RE.captures_iter(list_text) {
                    let t = item_caps.get(1).unwrap().as_str().trim().trim_matches(|c| c == '\'' || c == '"');
                    if !t.is_empty() {
                        tag_index
                            .entry(t.to_lowercase())
                            .or_default()
                            .push(rel_path.clone());
                    }
                }
            }
        }

        // Inline #tags (skip frontmatter)
        let body = FRONTMATTER_RE.replace(&content, "");
        for caps in INLINE_TAG_RE.captures_iter(&body) {
            let tag = caps.get(1).unwrap().as_str().to_lowercase();
            tag_index
                .entry(tag)
                .or_default()
                .push(rel_path.clone());
        }

        // --- Extract wiki-links ---
        for caps in WIKI_LINK_RE.captures_iter(&content) {
            let target = caps
                .get(1)
                .unwrap()
                .as_str()
                .to_lowercase()
                .trim_end_matches(".md")
                .to_string();
            backlink_index
                .entry(target)
                .or_default()
                .push(rel_path.clone());
        }
    }

    // Deduplicate (a file may have multiple occurrences of the same tag/link)
    for files in tag_index.values_mut() {
        files.sort();
        files.dedup();
    }
    for files in backlink_index.values_mut() {
        files.sort();
        files.dedup();
    }

    // Build FTS index from already-read file contents (single-pass, no re-read)
    if let Ok(conn) = fts::create_fts_db() {
        if fts::rebuild_fts_from_entries(&conn, &fts_entries).is_ok() {
            let mut guard = fts_state.0.lock().unwrap_or_else(|e| e.into_inner());
            *guard = Some(conn);
        }
    }

    Ok(VaultIndex {
        tag_index,
        backlink_index,
        property_index,
    })
}
