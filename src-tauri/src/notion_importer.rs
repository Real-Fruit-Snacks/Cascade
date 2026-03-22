use std::collections::HashMap;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::sync::LazyLock;

use regex::Regex;
use scraper::{ElementRef, Html, Selector};

use tauri::Emitter;

use crate::error::CascadeError;
use crate::importer::ImportResult;

static NOTION_UUID_RE: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"\s+[a-f0-9]{32}$").unwrap());
static BLANK_LINES_RE: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"\n{3,}").unwrap());
static SEL_CODE: LazyLock<Selector> = LazyLock::new(|| Selector::parse("code").unwrap());
static SEL_TR: LazyLock<Selector> = LazyLock::new(|| Selector::parse("tr").unwrap());
static SEL_TD_TH: LazyLock<Selector> = LazyLock::new(|| Selector::parse("td, th").unwrap());
static SEL_TABLE: LazyLock<Selector> = LazyLock::new(|| Selector::parse("table").unwrap());
static SEL_BODY: LazyLock<Selector> = LazyLock::new(|| Selector::parse("body").unwrap());
static SEL_HTML: LazyLock<Selector> = LazyLock::new(|| Selector::parse("html").unwrap());

/// Strip Notion UUID suffix from a filename stem.
/// e.g. "My Page abc123def456abc123def456abc123de" → "My Page"
fn strip_notion_uuid(name: &str) -> String {
    NOTION_UUID_RE.replace(name, "").to_string()
}

/// Clean a full filename (with extension): strip UUID from the stem.
fn clean_filename(filename: &str) -> String {
    if let Some(dot_pos) = filename.rfind('.') {
        let stem = &filename[..dot_pos];
        let ext = &filename[dot_pos..];
        format!("{}{}", strip_notion_uuid(stem), ext)
    } else {
        strip_notion_uuid(filename)
    }
}

/// Determine if a file extension is an image type.
fn is_image_ext(ext: &str) -> bool {
    matches!(
        ext.to_lowercase().as_str(),
        "png" | "jpg" | "jpeg" | "gif" | "webp" | "svg" | "bmp" | "ico" | "tiff" | "tif"
    )
}

/// Convert a scraper ElementRef tree to markdown text.
fn element_to_markdown(
    el: ElementRef,
    link_map: &HashMap<String, String>,
    indent: usize,
) -> String {
    let tag = el.value().name();

    match tag {
        "h1" => format!("# {}\n\n", inner_text(el)),
        "h2" => format!("## {}\n\n", inner_text(el)),
        "h3" => format!("### {}\n\n", inner_text(el)),
        "h4" => format!("#### {}\n\n", inner_text(el)),
        "h5" => format!("##### {}\n\n", inner_text(el)),
        "h6" => format!("###### {}\n\n", inner_text(el)),
        "p" => {
            let content = children_to_markdown(el, link_map, indent);
            if content.trim().is_empty() {
                String::new()
            } else {
                format!("{}\n\n", content.trim_end())
            }
        }
        "br" => "\n".to_string(),
        "hr" => "---\n\n".to_string(),
        "strong" | "b" => format!("**{}**", inner_text(el)),
        "em" | "i" => format!("*{}*", inner_text(el)),
        "s" | "del" | "strike" => format!("~~{}~~", inner_text(el)),
        "u" => {
            // Markdown has no native underline; preserve as HTML
            format!("<u>{}</u>", inner_text(el))
        }
        "code" => {
            // Check if parent is <pre>; if so, handled by "pre"
            format!("`{}`", inner_text(el))
        }
        "pre" => {
            // Look for a nested <code> element and extract language from class
            let (code_text, lang) = if let Some(code_el) = el.select(&*SEL_CODE).next() {
                let text = code_el.text().collect::<String>();
                // Notion/Prism uses class="language-xxx"
                let lang = code_el
                    .value()
                    .attr("class")
                    .unwrap_or("")
                    .split_whitespace()
                    .find(|c| c.starts_with("language-"))
                    .map(|c| &c["language-".len()..])
                    .unwrap_or("");
                (text, lang.to_string())
            } else {
                (el.text().collect::<String>(), String::new())
            };
            format!("```{}\n{}\n```\n\n", lang, code_text)
        }
        "blockquote" => {
            let inner = children_to_markdown(el, link_map, indent);
            inner
                .lines()
                .map(|l| format!("> {}", l))
                .collect::<Vec<_>>()
                .join("\n")
                + "\n\n"
        }
        "ul" => format_list(el, link_map, indent, false),
        "ol" => format_list(el, link_map, indent, true),
        "li" => {
            // Handled by ul/ol
            children_to_markdown(el, link_map, indent)
        }
        "input" => {
            // Notion exports checkboxes as <input type="checkbox" checked>
            let checked = el.value().attr("checked").is_some();
            if checked {
                "[x] ".to_string()
            } else {
                "[ ] ".to_string()
            }
        }
        "a" => {
            let href = el.value().attr("href").unwrap_or("").to_string();
            let text = inner_text(el);
            // If href refers to another page in the export (HTML file), use wiki-link
            if href.ends_with(".html") || href.ends_with(".htm") {
                let page_name = href_to_page_name(&href, link_map);
                format!("[[{}]]", page_name)
            } else {
                format!("[{}]({})", text, href)
            }
        }
        "img" => {
            let src = el.value().attr("src").unwrap_or("").to_string();
            let alt = el.value().attr("alt").unwrap_or("").to_string();
            format!("![{}]({})", alt, src)
        }
        "table" => convert_table(el),
        "div" | "section" | "article" | "main" | "body" | "html" | "header" | "footer"
        | "nav" | "aside" | "figure" | "figcaption" | "span" => {
            children_to_markdown(el, link_map, indent)
        }
        // Skip script/style
        "script" | "style" | "head" => String::new(),
        _ => children_to_markdown(el, link_map, indent),
    }
}

/// Format a <ul> or <ol> list recursively.
fn format_list(
    el: ElementRef,
    link_map: &HashMap<String, String>,
    indent: usize,
    ordered: bool,
) -> String {
    let mut out = String::new();
    let mut index = 1usize;
    let prefix_str = "  ".repeat(indent);

    for child in el.children() {
        if let Some(child_el) = ElementRef::wrap(child) {
            let name = child_el.value().name();
            if name == "li" {
                let bullet = if ordered {
                    format!("{}{}. ", prefix_str, index)
                } else {
                    format!("{}- ", prefix_str)
                };
                index += 1;

                // Check if li has nested ul/ol
                let mut li_text = String::new();
                let mut nested = String::new();
                for li_child in child_el.children() {
                    if let Some(li_child_el) = ElementRef::wrap(li_child) {
                        match li_child_el.value().name() {
                            "ul" => nested.push_str(&format_list(
                                li_child_el,
                                link_map,
                                indent + 1,
                                false,
                            )),
                            "ol" => nested.push_str(&format_list(
                                li_child_el,
                                link_map,
                                indent + 1,
                                true,
                            )),
                            _ => li_text.push_str(&element_to_markdown(
                                li_child_el,
                                link_map,
                                indent + 1,
                            )),
                        }
                    } else if let Some(text) = child.value().as_text() {
                        li_text.push_str(text.trim());
                    } else {
                        // text node inside li
                        use scraper::node::Node;
                        if let Node::Text(t) = li_child.value() {
                            li_text.push_str(t.trim());
                        }
                    }
                }
                out.push_str(&format!("{}{}\n", bullet, li_text.trim()));
                if !nested.is_empty() {
                    out.push_str(&nested);
                }
            }
        }
    }
    if !out.is_empty() {
        out.push('\n');
    }
    out
}

/// Get inner text of an element (no markdown conversion).
fn inner_text(el: ElementRef) -> String {
    el.text().collect::<String>()
}

/// Convert all children of an element to markdown.
fn children_to_markdown(
    el: ElementRef,
    link_map: &HashMap<String, String>,
    indent: usize,
) -> String {
    let mut out = String::new();
    for child in el.children() {
        use scraper::node::Node;
        match child.value() {
            Node::Text(t) => {
                let s = t.to_string();
                // Only add non-whitespace-only text
                if !s.trim().is_empty() {
                    out.push_str(&s);
                } else if s.contains('\n') {
                    // preserve single space for inline separation
                    out.push(' ');
                }
            }
            Node::Element(_) => {
                if let Some(child_el) = ElementRef::wrap(child) {
                    out.push_str(&element_to_markdown(child_el, link_map, indent));
                }
            }
            _ => {}
        }
    }
    out
}

/// Convert href to page name using link_map or by stripping path/extension.
fn href_to_page_name(href: &str, link_map: &HashMap<String, String>) -> String {
    // href may be URL-encoded or path-like; get just the filename portion
    let decoded = urlencoding_decode(href);
    let filename = Path::new(&decoded)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or(&decoded)
        .to_string();

    // Look up in link_map (original → clean name)
    if let Some(clean) = link_map.get(&filename) {
        // Return stem (no extension)
        Path::new(clean)
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or(clean)
            .to_string()
    } else {
        // Clean up the filename ourselves
        let clean = clean_filename(&filename);
        Path::new(&clean)
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or(&clean)
            .to_string()
    }
}

/// URL percent-decoding.
fn urlencoding_decode(s: &str) -> String {
    let mut result = Vec::new();
    let bytes = s.as_bytes();
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            let hi = bytes[i + 1];
            let lo = bytes[i + 2];
            if let (Some(h), Some(l)) = (hex_val(hi), hex_val(lo)) {
                result.push(h << 4 | l);
                i += 3;
                continue;
            }
        }
        result.push(bytes[i]);
        i += 1;
    }
    String::from_utf8(result).unwrap_or_else(|_| s.to_string())
}

fn hex_val(b: u8) -> Option<u8> {
    match b {
        b'0'..=b'9' => Some(b - b'0'),
        b'a'..=b'f' => Some(b - b'a' + 10),
        b'A'..=b'F' => Some(b - b'A' + 10),
        _ => None,
    }
}

/// Convert an HTML <table> to a markdown table.
fn convert_table(el: ElementRef) -> String {
    let rows: Vec<Vec<String>> = el
        .select(&*SEL_TR)
        .map(|row| {
            row.select(&*SEL_TD_TH)
                .map(|cell| inner_text(cell).trim().replace('\n', " ").replace('|', "\\|"))
                .collect()
        })
        .filter(|row: &Vec<String>| !row.is_empty())
        .collect();

    if rows.is_empty() {
        return String::new();
    }

    let col_count = rows.iter().map(|r| r.len()).max().unwrap_or(0);
    let mut out = String::new();

    for (i, row) in rows.iter().enumerate() {
        let mut cells = row.clone();
        // Pad to col_count
        while cells.len() < col_count {
            cells.push(String::new());
        }
        out.push_str(&format!("| {} |\n", cells.join(" | ")));
        if i == 0 {
            // Add separator row
            let sep = vec!["---".to_string(); col_count];
            out.push_str(&format!("| {} |\n", sep.join(" | ")));
        }
    }
    out.push('\n');
    out
}

/// Check if the first table in the document looks like a Notion properties table.
/// Returns Some(frontmatter_string) if so.
fn extract_notion_properties(doc: &Html) -> Option<String> {
    let table = doc.select(&*SEL_TABLE).next()?;

    let rows: Vec<(String, String)> = table
        .select(&*SEL_TR)
        .filter_map(|row| {
            let cells: Vec<String> = row
                .select(&*SEL_TD_TH)
                .map(|c| inner_text(c).trim().to_string())
                .collect();
            if cells.len() == 2 && !cells[0].is_empty() {
                Some((cells[0].clone(), cells[1].clone()))
            } else {
                None
            }
        })
        .collect();

    if rows.is_empty() {
        return None;
    }

    let mut fm = String::from("---\n");
    for (key, value) in &rows {
        // Sanitize key: lowercase, replace spaces with underscores
        let k = key.to_lowercase().replace(' ', "_");
        // Quote value if it contains special YAML chars
        if value.contains(':') || value.starts_with('"') || value.starts_with('\'') {
            fm.push_str(&format!("{}: \"{}\"\n", k, value.replace('"', "\\\"")));
        } else {
            fm.push_str(&format!("{}: {}\n", k, value));
        }
    }
    fm.push_str("---\n\n");
    Some(fm)
}

/// Convert HTML content to markdown, with frontmatter extraction.
fn html_to_markdown(html_content: &str, link_map: &HashMap<String, String>) -> String {
    let doc = Html::parse_document(html_content);

    // Try to extract Notion properties as frontmatter
    let frontmatter = extract_notion_properties(&doc);

    // Extract the <body> or fall back to <html>
    let root_el = doc
        .select(&*SEL_BODY)
        .next()
        .or_else(|| doc.select(&*SEL_HTML).next());

    let markdown_body = if let Some(root) = root_el {
        // If we found a properties table, skip the first <table> in body
        if frontmatter.is_some() {
            // Remove the first table from rendering by tracking whether we've skipped it
            convert_body_skip_first_table(root, link_map)
        } else {
            children_to_markdown(root, link_map, 0)
        }
    } else {
        String::new()
    };

    let result = format!(
        "{}{}",
        frontmatter.unwrap_or_default(),
        markdown_body.trim()
    );

    // Collapse 3+ consecutive blank lines to 2
    BLANK_LINES_RE.replace_all(&result, "\n\n").to_string()
}

/// Convert body children to markdown, skipping the first <table> encountered.
fn convert_body_skip_first_table(el: ElementRef, link_map: &HashMap<String, String>) -> String {
    let mut out = String::new();
    let mut skipped_table = false;

    for child in el.children() {
        use scraper::node::Node;
        match child.value() {
            Node::Text(t) => {
                let s = t.to_string();
                if !s.trim().is_empty() {
                    out.push_str(&s);
                }
            }
            Node::Element(e) => {
                if e.name() == "table" && !skipped_table {
                    skipped_table = true;
                    continue;
                }
                if let Some(child_el) = ElementRef::wrap(child) {
                    out.push_str(&element_to_markdown(child_el, link_map, 0));
                }
            }
            _ => {}
        }
    }
    out
}

/// The main Tauri command: import a Notion export zip into the vault.
#[tauri::command]
pub fn import_notion_export(
    app_handle: tauri::AppHandle,
    vault_root: String,
    export_path: String,
) -> Result<ImportResult, CascadeError> {
    let vault_path = PathBuf::from(&vault_root);
    let zip_path = PathBuf::from(&export_path);

    if !vault_path.is_dir() {
        return Err(CascadeError::Import(format!(
            "Vault root is not a directory: {}",
            vault_root
        )));
    }

    let zip_file = std::fs::File::open(&zip_path)
        .map_err(|e| CascadeError::Import(format!("Cannot open zip: {}", e)))?;

    let mut archive = zip::ZipArchive::new(zip_file)
        .map_err(|e| CascadeError::Import(format!("Invalid zip archive: {}", e)))?;

    // First pass: build a map of original zip entry names to clean names
    // so we can rewrite internal links later.
    let mut link_map: HashMap<String, String> = HashMap::new();
    for i in 0..archive.len() {
        let entry = archive
            .by_index(i)
            .map_err(|e| CascadeError::Import(format!("Zip read error: {}", e)))?;
        let raw_name = entry.name().to_string();
        if entry.is_dir() {
            continue;
        }
        let file_path = Path::new(&raw_name);
        if let Some(filename) = file_path.file_name().and_then(|n| n.to_str()) {
            let clean = clean_filename(filename);
            link_map.insert(filename.to_string(), clean);
        }
    }

    let mut files_imported: u32 = 0;
    let mut files_skipped: u32 = 0;
    let mut errors: Vec<String> = Vec::new();
    let total_entries = archive.len() as u32;

    // Second pass: process each entry
    for i in 0..archive.len() {
        app_handle.emit("import://progress", serde_json::json!({
            "current": i as u32 + 1, "total": total_entries, "file": "",
        })).ok();

        let mut entry = match archive.by_index(i) {
            Ok(e) => e,
            Err(e) => {
                errors.push(format!("Zip entry {} read error: {}", i, e));
                continue;
            }
        };

        if entry.is_dir() {
            continue;
        }

        let raw_name = entry.name().to_string();
        let zip_entry_path = Path::new(&raw_name);

        // Determine the output path with cleaned filename
        let clean_entry_path = clean_zip_path(zip_entry_path);
        let dest_path = vault_path.join(&clean_entry_path);

        // Create parent directories
        if let Some(parent) = dest_path.parent() {
            if let Err(e) = std::fs::create_dir_all(parent) {
                errors.push(format!("Cannot create dir {:?}: {}", parent, e));
                continue;
            }
        }

        let ext = zip_entry_path
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("")
            .to_lowercase();

        if ext == "html" || ext == "htm" {
            // Read the HTML content
            let mut content = String::new();
            if let Err(e) = entry.read_to_string(&mut content) {
                errors.push(format!("Cannot read HTML {}: {}", raw_name, e));
                files_skipped += 1;
                continue;
            }

            // Convert to markdown
            let markdown = html_to_markdown(&content, &link_map);

            // Write as .md file
            let md_dest = dest_path.with_extension("md");
            if let Err(e) = std::fs::write(&md_dest, markdown) {
                errors.push(format!("Cannot write {:?}: {}", md_dest, e));
                files_skipped += 1;
            } else {
                files_imported += 1;
            }
        } else if ext == "md" || ext == "markdown" {
            // Copy markdown files directly
            let mut content = Vec::new();
            if let Err(e) = entry.read_to_end(&mut content) {
                errors.push(format!("Cannot read {}: {}", raw_name, e));
                files_skipped += 1;
                continue;
            }
            if let Err(e) = std::fs::write(&dest_path, content) {
                errors.push(format!("Cannot write {:?}: {}", dest_path, e));
                files_skipped += 1;
            } else {
                files_imported += 1;
            }
        } else if is_image_ext(&ext) {
            // Copy images to attachments subfolder
            let filename = zip_entry_path
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("image");
            let clean_img_name = clean_filename(filename);
            let attachments_dir = vault_path.join("attachments");
            if let Err(e) = std::fs::create_dir_all(&attachments_dir) {
                errors.push(format!("Cannot create attachments dir: {}", e));
                files_skipped += 1;
                continue;
            }
            let img_dest = attachments_dir.join(&clean_img_name);
            let mut content = Vec::new();
            if let Err(e) = entry.read_to_end(&mut content) {
                errors.push(format!("Cannot read image {}: {}", raw_name, e));
                files_skipped += 1;
                continue;
            }
            if let Err(e) = std::fs::write(&img_dest, content) {
                errors.push(format!("Cannot write image {:?}: {}", img_dest, e));
                files_skipped += 1;
            } else {
                files_imported += 1;
            }
        } else {
            // Skip other binary/non-document files
            files_skipped += 1;
        }
    }

    Ok(ImportResult {
        files_imported,
        files_skipped,
        errors,
    })
}

/// Clean all path components of a zip entry path, stripping Notion UUIDs from each segment.
fn clean_zip_path(p: &Path) -> PathBuf {
    let mut result = PathBuf::new();
    let components: Vec<_> = p.components().collect();
    let count = components.len();

    for (i, component) in components.iter().enumerate() {
        use std::path::Component;
        match component {
            Component::Normal(seg) => {
                let seg_str = seg.to_str().unwrap_or("");
                if i == count - 1 {
                    // Last component: it's the filename
                    result.push(clean_filename(seg_str));
                } else {
                    // Directory segment: strip UUID
                    result.push(strip_notion_uuid(seg_str));
                }
            }
            _ => {} // Skip root, prefix, cur, parent components for safety
        }
    }
    result
}
