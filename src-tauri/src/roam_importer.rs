use std::collections::HashMap;
use std::path::PathBuf;

use regex::Regex;
use serde::Deserialize;
use serde_json::Value;

use tauri::Emitter;

use crate::error::CascadeError;
use crate::importer::ImportResult;

#[derive(Deserialize, Debug)]
struct RoamPage {
    title: String,
    #[serde(default)]
    children: Vec<RoamBlock>,
    #[serde(rename = "create-time")]
    create_time: Option<i64>,
    #[serde(rename = "edit-time")]
    edit_time: Option<i64>,
    uid: Option<String>,
}

#[derive(Deserialize, Debug)]
struct RoamBlock {
    #[serde(default)]
    string: String,
    #[serde(default)]
    uid: String,
    #[serde(default)]
    children: Vec<RoamBlock>,
    heading: Option<u8>,
    #[serde(rename = "create-time")]
    _create_time: Option<i64>,
    #[serde(rename = "edit-time")]
    _edit_time: Option<i64>,
}

/// Build a map from block UID → page title by walking all pages and their blocks recursively.
fn build_uid_page_map(pages: &[RoamPage]) -> HashMap<String, String> {
    let mut map = HashMap::new();
    for page in pages {
        if let Some(uid) = &page.uid {
            map.insert(uid.clone(), page.title.clone());
        }
        collect_block_uids(&page.children, &page.title, &mut map);
    }
    map
}

fn collect_block_uids(blocks: &[RoamBlock], page_title: &str, map: &mut HashMap<String, String>) {
    for block in blocks {
        if !block.uid.is_empty() {
            map.insert(block.uid.clone(), page_title.to_string());
        }
        collect_block_uids(&block.children, page_title, map);
    }
}

/// Convert a Unix millisecond timestamp to an ISO 8601 UTC string.
fn ms_to_iso(ms: i64) -> String {
    // Guard against negative or pre-epoch timestamps
    if ms < 0 {
        return "1970-01-01T00:00:00Z".to_string();
    }
    let total_secs = (ms / 1000) as u64;
    let sec = total_secs % 60;
    let min = (total_secs / 60) % 60;
    let hour = (total_secs / 3600) % 24;
    let days = total_secs / 86400;
    let (year, month, day) = days_to_ymd(days);
    format!(
        "{:04}-{:02}-{:02}T{:02}:{:02}:{:02}Z",
        year, month, day, hour, min, sec
    )
}

fn days_to_ymd(days: u64) -> (u64, u64, u64) {
    // Algorithm from http://howardhinnant.github.io/date_algorithms.html
    let z = days + 719468;
    let era = z / 146097;
    let doe = z % 146097;
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let y = if m <= 2 { y + 1 } else { y };
    (y, m, d)
}

/// Convert Roam markup in a single string to Obsidian-compatible markdown.
fn convert_roam_syntax(text: &str, uid_page_map: &HashMap<String, String>) -> String {
    let mut s = text.to_string();

    // {{TODO}} / {{[[TODO]]}} → - [ ]  (handled at block level, but strip inline occurrences too)
    s = s.replace("{{[[TODO]]}}", "- [ ]");
    s = s.replace("{{[[DONE]]}}", "- [x]");
    s = s.replace("{{TODO}}", "- [ ]");
    s = s.replace("{{DONE}}", "- [x]");

    // {{embed: ((uid))}} → ![[page#^uid]]
    let embed_re = Regex::new(r"\{\{embed:\s*\(\(([^)]+)\)\)\}\}").unwrap();
    s = embed_re
        .replace_all(&s, |caps: &regex::Captures| {
            let uid = &caps[1];
            let page = uid_page_map.get(uid).map(|t| t.as_str()).unwrap_or("unknown");
            format!("![[{}#^{}]]", page, uid)
        })
        .into_owned();

    // ((block-uid)) → [[page#^uid]]
    let block_ref_re = Regex::new(r"\(\(([^)]+)\)\)").unwrap();
    s = block_ref_re
        .replace_all(&s, |caps: &regex::Captures| {
            let uid = &caps[1];
            let page = uid_page_map.get(uid).map(|t| t.as_str()).unwrap_or("unknown");
            format!("[[{}#^{}]]", page, uid)
        })
        .into_owned();

    // #[[nested tag]] → #nested-tag (kebab-case)
    let nested_tag_re = Regex::new(r"#\[\[([^\]]+)\]\]").unwrap();
    s = nested_tag_re
        .replace_all(&s, |caps: &regex::Captures| {
            let tag = caps[1].trim().to_lowercase().replace(' ', "-");
            format!("#{}", tag)
        })
        .into_owned();

    // [[page links]] are already compatible — no change needed.

    // __italic__ → *italic*
    let italic_re = Regex::new(r"__(.+?)__").unwrap();
    s = italic_re.replace_all(&s, "*$1*").into_owned();

    // ^^highlight^^ → ==highlight==
    let highlight_re = Regex::new(r"\^\^(.+?)\^\^").unwrap();
    s = highlight_re.replace_all(&s, "==$1==").into_owned();

    s
}

/// Render a block (and its children) as markdown lines.
fn render_block(
    block: &RoamBlock,
    depth: usize,
    uid_page_map: &HashMap<String, String>,
    lines: &mut Vec<String>,
) {
    let content = convert_roam_syntax(&block.string, uid_page_map);
    let uid_suffix = if !block.uid.is_empty() {
        format!(" ^{}", block.uid)
    } else {
        String::new()
    };

    // Check for TODO/DONE checkbox markers (already substituted inline)
    let is_checkbox = content.starts_with("- [ ]") || content.starts_with("- [x]");

    let line = if let Some(level) = block.heading {
        // Heading block — level 1/2/3
        let hashes = "#".repeat(level.clamp(1, 6) as usize);
        format!("{} {}{}", hashes, content, uid_suffix)
    } else if is_checkbox {
        // Already has checkbox syntax from conversion — keep but add indent
        let indent = "  ".repeat(depth);
        format!("{}{}{}", indent, content, uid_suffix)
    } else {
        let indent = "  ".repeat(depth);
        format!("{}- {}{}", indent, content, uid_suffix)
    };

    lines.push(line);

    for child in &block.children {
        render_block(child, depth + 1, uid_page_map, lines);
    }
}

/// Sanitize a page title into a safe filename.
fn sanitize_filename(title: &str) -> String {
    let forbidden: &[char] = &['/', '\\', ':', '*', '?', '"', '<', '>', '|'];
    let sanitized: String = title
        .chars()
        .map(|c| if forbidden.contains(&c) { '_' } else { c })
        .collect();
    // Truncate to 200 chars to stay safe on all file systems
    sanitized.chars().take(200).collect()
}

/// Convert a single Roam page to markdown text.
fn page_to_markdown(page: &RoamPage, uid_page_map: &HashMap<String, String>) -> String {
    let created = page
        .create_time
        .map(ms_to_iso)
        .unwrap_or_else(|| "1970-01-01T00:00:00Z".to_string());
    let modified = page
        .edit_time
        .map(ms_to_iso)
        .unwrap_or_else(|| "1970-01-01T00:00:00Z".to_string());
    let roam_uid = page.uid.as_deref().unwrap_or("");

    // Quote title if it contains YAML-special characters
    let title_yaml = if page.title.contains(':')
        || page.title.contains('#')
        || page.title.contains('"')
        || page.title.contains('\'')
        || page.title.contains('\n')
        || page.title.starts_with('[')
        || page.title.starts_with('{')
    {
        format!(
            "\"{}\"",
            page.title.replace('\\', "\\\\").replace('"', "\\\"")
        )
    } else {
        page.title.clone()
    };

    let mut output = format!(
        "---\ntitle: {}\ncreated: {}\nmodified: {}\nroam-uid: {}\n---\n\n",
        title_yaml, created, modified, roam_uid
    );

    let mut lines: Vec<String> = Vec::new();
    for block in &page.children {
        render_block(block, 0, uid_page_map, &mut lines);
    }

    output.push_str(&lines.join("\n"));
    if !lines.is_empty() {
        output.push('\n');
    }

    output
}

#[tauri::command]
pub fn import_roam_export(
    app_handle: tauri::AppHandle,
    vault_root: String,
    export_path: String,
) -> Result<ImportResult, CascadeError> {
    let export_content = std::fs::read_to_string(&export_path)
        .map_err(|e| CascadeError::Import(format!("Failed to read export file: {}", e)))?;

    let raw: Value = serde_json::from_str(&export_content)
        .map_err(|e| CascadeError::Import(format!("Invalid JSON in export file: {}", e)))?;

    let pages_value = raw
        .as_array()
        .ok_or_else(|| CascadeError::Import("Roam export must be a JSON array".to_string()))?;

    // Parse all pages first (ignore parse errors per page, collect them)
    let mut pages: Vec<RoamPage> = Vec::new();
    let mut parse_errors: Vec<String> = Vec::new();
    for (i, page_val) in pages_value.iter().enumerate() {
        match serde_json::from_value::<RoamPage>(page_val.clone()) {
            Ok(p) => pages.push(p),
            Err(e) => parse_errors.push(format!("Page {}: parse error: {}", i, e)),
        }
    }

    // Build UID → page title map before processing content
    let uid_page_map = build_uid_page_map(&pages);

    let vault_path = PathBuf::from(&vault_root);
    let mut result = ImportResult {
        errors: parse_errors,
        ..Default::default()
    };

    let total_pages = pages.len() as u32;
    for (idx, page) in pages.iter().enumerate() {
        app_handle.emit("import://progress", serde_json::json!({
            "current": idx as u32 + 1, "total": total_pages, "file": &page.title,
        })).ok();

        let filename = format!("{}.md", sanitize_filename(&page.title));
        let dest = vault_path.join(&filename);

        // Skip if file already exists
        if dest.exists() {
            result.files_skipped += 1;
            continue;
        }

        let markdown = page_to_markdown(page, &uid_page_map);

        match std::fs::write(&dest, &markdown) {
            Ok(_) => result.files_imported += 1,
            Err(e) => {
                result.errors.push(format!(
                    "Failed to write '{}': {}",
                    filename, e
                ));
                result.files_skipped += 1;
            }
        }
    }

    Ok(result)
}
