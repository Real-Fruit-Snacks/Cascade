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

    // --- Also scan .canvas files for backlinks (file nodes reference other files) ---
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
        if path.extension().and_then(|e| e.to_str()) != Some("canvas") {
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

        // Parse canvas JSON and extract file node references
        if let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) {
            if let Some(nodes) = json.get("nodes").and_then(|n| n.as_array()) {
                for node in nodes {
                    if node.get("type").and_then(|t| t.as_str()) == Some("file") {
                        if let Some(file_ref) = node.get("file").and_then(|f| f.as_str()) {
                            // Normalize the referenced file path as backlink target
                            let target = file_ref
                                .to_lowercase()
                                .trim_end_matches(".md")
                                .to_string();
                            backlink_index
                                .entry(target)
                                .or_default()
                                .push(rel_path.clone());
                        }
                    }
                }
            }
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

#[cfg(test)]
mod tests {
    use super::*;

    // Helper to extract a Text value
    fn as_text(v: &PropertyValue) -> Option<&str> {
        if let PropertyValue::Text(s) = v { Some(s.as_str()) } else { None }
    }
    fn as_bool(v: &PropertyValue) -> Option<bool> {
        if let PropertyValue::Bool(b) = v { Some(*b) } else { None }
    }
    fn as_number(v: &PropertyValue) -> Option<f64> {
        if let PropertyValue::Number(n) = v { Some(*n) } else { None }
    }
    fn as_list(v: &PropertyValue) -> Option<&Vec<String>> {
        if let PropertyValue::List(l) = v { Some(l) } else { None }
    }

    #[test]
    fn test_empty_yaml() {
        let props = parse_frontmatter_properties("");
        assert!(props.is_empty());
    }

    #[test]
    fn test_simple_text_property() {
        let yaml = "title: Hello World\nauthor: Alice";
        let props = parse_frontmatter_properties(yaml);
        assert_eq!(as_text(props.get("title").unwrap()), Some("Hello World"));
        assert_eq!(as_text(props.get("author").unwrap()), Some("Alice"));
    }

    #[test]
    fn test_boolean_properties() {
        let yaml = "draft: true\npublished: false\nFEATURED: True";
        let props = parse_frontmatter_properties(yaml);
        assert_eq!(as_bool(props.get("draft").unwrap()), Some(true));
        assert_eq!(as_bool(props.get("published").unwrap()), Some(false));
        assert_eq!(as_bool(props.get("FEATURED").unwrap()), Some(true));
    }

    #[test]
    fn test_numeric_property() {
        let yaml = "weight: 42\nrating: 4.5\nnegative: -1";
        let props = parse_frontmatter_properties(yaml);
        assert_eq!(as_number(props.get("weight").unwrap()), Some(42.0));
        assert_eq!(as_number(props.get("rating").unwrap()), Some(4.5));
        assert_eq!(as_number(props.get("negative").unwrap()), Some(-1.0));
    }

    #[test]
    fn test_inline_list_property() {
        let yaml = "aliases: [foo, bar, baz]";
        let props = parse_frontmatter_properties(yaml);
        let list = as_list(props.get("aliases").unwrap()).unwrap();
        assert_eq!(list, &["foo", "bar", "baz"]);
    }

    #[test]
    fn test_inline_list_with_quotes() {
        let yaml = "aliases: ['note one', \"note two\"]";
        let props = parse_frontmatter_properties(yaml);
        let list = as_list(props.get("aliases").unwrap()).unwrap();
        assert_eq!(list, &["note one", "note two"]);
    }

    #[test]
    fn test_block_list_property() {
        let yaml = "aliases:\n  - first\n  - second\n  - third";
        let props = parse_frontmatter_properties(yaml);
        let list = as_list(props.get("aliases").unwrap()).unwrap();
        assert_eq!(list, &["first", "second", "third"]);
    }

    #[test]
    fn test_quoted_text_value() {
        let yaml = "title: \"My Note\"\nauthor: 'Bob'";
        let props = parse_frontmatter_properties(yaml);
        assert_eq!(as_text(props.get("title").unwrap()), Some("My Note"));
        assert_eq!(as_text(props.get("author").unwrap()), Some("Bob"));
    }

    #[test]
    fn test_empty_value() {
        let yaml = "title:\nauthor: Alice";
        let props = parse_frontmatter_properties(yaml);
        assert_eq!(as_text(props.get("title").unwrap()), Some(""));
        assert_eq!(as_text(props.get("author").unwrap()), Some("Alice"));
    }

    #[test]
    fn test_nested_properties_ignored() {
        // Indented keys (nested YAML) should be skipped at top level
        let yaml = "parent:\n  child: value\ntop: present";
        let props = parse_frontmatter_properties(yaml);
        // "child" is indented so should NOT be a top-level key
        assert!(!props.contains_key("child"));
        assert!(props.contains_key("top"));
    }

    #[test]
    fn test_tags_key_still_parsed_as_property() {
        // parse_frontmatter_properties parses all keys including tags
        let yaml = "tags: [rust, notes]";
        let props = parse_frontmatter_properties(yaml);
        let list = as_list(props.get("tags").unwrap()).unwrap();
        assert!(list.contains(&"rust".to_string()));
        assert!(list.contains(&"notes".to_string()));
    }

    #[test]
    fn test_malformed_yaml_no_colon() {
        // A line with no colon should be silently skipped
        let yaml = "this is not valid yaml\ntitle: Good";
        let props = parse_frontmatter_properties(yaml);
        // Should still parse the valid line
        assert_eq!(as_text(props.get("title").unwrap()), Some("Good"));
    }

    #[test]
    fn test_inline_list_empty() {
        let yaml = "tags: []";
        let props = parse_frontmatter_properties(yaml);
        // Empty inline list: items filtered to non-empty, so may be empty list or absent
        // The current implementation inserts an empty List
        match props.get("tags") {
            Some(PropertyValue::List(l)) => assert!(l.is_empty()),
            None => {} // also acceptable
            _ => panic!("unexpected value type"),
        }
    }

    #[test]
    fn test_multiple_colons_in_value() {
        // Value containing colons should be preserved after the first colon
        let yaml = "url: https://example.com/path";
        let props = parse_frontmatter_properties(yaml);
        assert_eq!(as_text(props.get("url").unwrap()), Some("https://example.com/path"));
    }

    #[test]
    fn test_frontmatter_regex_matches_valid() {
        let content = "---\ntitle: Test\n---\n\nBody text here.";
        let caps = FRONTMATTER_RE.captures(content);
        assert!(caps.is_some());
        let yaml = caps.unwrap().get(1).unwrap().as_str();
        assert_eq!(yaml, "title: Test");
    }

    #[test]
    fn test_frontmatter_regex_no_match_without_opening() {
        let content = "title: Test\n---\n\nBody text here.";
        assert!(FRONTMATTER_RE.captures(content).is_none());
    }

    #[test]
    fn test_frontmatter_regex_no_match_without_closing() {
        let content = "---\ntitle: Test\n\nBody text here.";
        assert!(FRONTMATTER_RE.captures(content).is_none());
    }
}
