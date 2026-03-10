use std::fs;
use std::io;
use std::path::{Path, PathBuf};

use regex::Regex;
use walkdir::WalkDir;

use tauri::Emitter;

use crate::error::CascadeError;
use crate::importer::ImportResult;

/// Characters not allowed in Windows filenames.
const INVALID_FILENAME_CHARS: &[char] = &['/', '\\', ':', '*', '?', '"', '<', '>', '|'];

fn sanitize_filename(name: &str) -> String {
    let sanitized: String = name
        .chars()
        .map(|c| if INVALID_FILENAME_CHARS.contains(&c) { '_' } else { c })
        .collect();
    // Truncate to 200 chars to stay safe on all file systems
    sanitized.chars().take(200).collect()
}

/// Apply Bear tag conversion (#tag# → #tag) to a single line, skipping inline code spans.
/// Splits the line by backtick-delimited spans and only processes non-code segments.
fn convert_tags_in_line(line: &str, tag_re: &Regex) -> String {
    let parts: Vec<&str> = line.split('`').collect();
    let mut result = String::with_capacity(line.len());
    for (i, part) in parts.iter().enumerate() {
        if i % 2 == 0 {
            // Outside a backtick span — apply tag conversion
            let converted = tag_re.replace_all(part, |caps: &regex::Captures| {
                let inner = caps[1].trim();
                let converted: String = inner
                    .split('/')
                    .map(|segment| segment.split_whitespace().collect::<Vec<_>>().join("-"))
                    .collect::<Vec<_>>()
                    .join("/");
                format!("#{}", converted)
            });
            result.push_str(&converted);
        } else {
            // Inside a backtick span — preserve verbatim, restoring the surrounding backticks
            result.push('`');
            result.push_str(part);
            result.push('`');
        }
    }
    result
}

/// Convert Bear-specific markdown syntax to standard markdown.
fn convert_bear_markdown(content: &str) -> String {
    // Compile regexes (cheap enough for per-file use; Bear exports are one-off imports)
    let tag_re = Regex::new(r"#([^#\n]+)#").expect("valid regex");
    let highlight_re = Regex::new(r"::([^:]+)::").expect("valid regex");
    let attachment_re = Regex::new(r"\[file:([^\]]+)\]").expect("valid regex");

    // 1. Convert Bear tags: #tag# or #multi word tag# → #tag or #multi-word-tag
    //    Process line by line, skipping fenced code blocks and inline code spans.
    let mut tag_converted = String::with_capacity(content.len());
    let mut in_fence = false;
    let mut lines = content.split('\n').peekable();
    while let Some(line) = lines.next() {
        if line.trim_start().starts_with("```") {
            in_fence = !in_fence;
            tag_converted.push_str(line);
        } else if in_fence {
            tag_converted.push_str(line);
        } else {
            tag_converted.push_str(&convert_tags_in_line(line, &tag_re));
        }
        // Re-add the newline separator (split consumed it); omit trailing newline only if the
        // original content did not end with one.
        if lines.peek().is_some() {
            tag_converted.push('\n');
        }
    }
    // Preserve a trailing newline if the original had one.
    if content.ends_with('\n') {
        tag_converted.push('\n');
    }

    // 2. Convert ::highlight:: → ==highlight==
    let result = highlight_re.replace_all(&tag_converted, "==$1==");

    // 3. Convert Bear [file:path/to/file] attachment references
    let result = attachment_re.replace_all(&result, |caps: &regex::Captures| {
        let path = &caps[1];
        let filename = Path::new(path)
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or(path);
        let ext = Path::new(filename)
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("")
            .to_lowercase();
        let is_image = matches!(ext.as_str(), "png" | "jpg" | "jpeg" | "gif" | "svg" | "webp");
        if is_image {
            format!("![](attachments/{})", filename)
        } else {
            format!("[{}](attachments/{})", filename, filename)
        }
    });

    result.into_owned()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_bear_tags_skip_code() {
        let input = "Hello #tag# and `#not-a-tag#` here\n```\n#code-tag#\n```\nAfter #real#";
        let result = convert_bear_markdown(input);
        assert!(result.contains("#tag"));
        assert!(result.contains("`#not-a-tag#`"));
        assert!(result.contains("#code-tag#"));
        assert!(result.contains("#real"));
    }
}

/// Process a single Bear .md file: convert syntax and write to vault.
/// Returns Ok((written, attachment_errors)) where written is true if the note was written.
fn process_md_file(
    md_path: &Path,
    vault_root: &Path,
    attachments_dir: &Path,
) -> Result<(bool, Vec<String>), String> {
    let raw = fs::read_to_string(md_path)
        .map_err(|e| format!("Read {}: {}", md_path.display(), e))?;

    let converted = convert_bear_markdown(&raw);

    // Derive output filename from first H1 heading, falling back to the file stem.
    let title = raw
        .lines()
        .find(|l| l.starts_with("# "))
        .map(|l| l.trim_start_matches('#').trim().to_string())
        .unwrap_or_else(|| {
            md_path
                .file_stem()
                .and_then(|s| s.to_str())
                .unwrap_or("untitled")
                .to_string()
        });

    let safe_title = sanitize_filename(&title);
    let out_path = vault_root.join(format!("{}.md", safe_title));

    fs::write(&out_path, converted.as_bytes())
        .map_err(|e| format!("Write {}: {}", out_path.display(), e))?;

    // Copy sibling attachments (files in a same-named subfolder Bear exports alongside notes).
    // Bear typically exports attachments in a folder named after the note stem.
    let mut attachment_errors = Vec::new();
    let note_stem = md_path.file_stem().and_then(|s| s.to_str()).unwrap_or("");
    if let Some(parent) = md_path.parent() {
        let sibling_dir = parent.join(note_stem);
        if sibling_dir.is_dir() {
            attachment_errors = copy_attachments_from_dir(&sibling_dir, attachments_dir);
        }
    }

    Ok((true, attachment_errors))
}

/// Copy all non-.md files from `src_dir` into `dest_dir`, creating dest if needed.
/// Returns a list of error messages for any attachments that failed to copy.
fn copy_attachments_from_dir(src_dir: &Path, dest_dir: &Path) -> Vec<String> {
    let mut errors = Vec::new();
    if let Err(e) = fs::create_dir_all(dest_dir) {
        errors.push(format!(
            "Create attachments dir {}: {}",
            dest_dir.display(),
            e
        ));
        return errors;
    }
    for entry in WalkDir::new(src_dir).min_depth(1).max_depth(1) {
        let Ok(entry) = entry else { continue };
        let path = entry.path();
        if path.is_file() {
            let ext = path
                .extension()
                .and_then(|e| e.to_str())
                .unwrap_or("")
                .to_lowercase();
            if ext == "md" {
                continue;
            }
            if let Some(fname) = path.file_name() {
                let dest = dest_dir.join(fname);
                if let Err(e) = fs::copy(path, &dest) {
                    errors.push(format!("Copy attachment {}: {}", path.display(), e));
                }
            }
        }
    }
    errors
}

/// Copy a non-.md file directly to the attachments directory (top-level attachment).
/// Returns an error message on failure, or None on success.
fn copy_attachment(src: &Path, dest_dir: &Path) -> Option<String> {
    if let Err(e) = fs::create_dir_all(dest_dir) {
        return Some(format!(
            "Create attachments dir {}: {}",
            dest_dir.display(),
            e
        ));
    }
    if let Some(fname) = src.file_name() {
        let dest = dest_dir.join(fname);
        if let Err(e) = fs::copy(src, &dest) {
            return Some(format!("Copy attachment {}: {}", src.display(), e));
        }
    }
    None
}

/// Process all files found under `export_dir`.
fn process_export_dir(export_dir: &Path, vault_root: &Path, result: &mut ImportResult, app_handle: &tauri::AppHandle) {
    let attachments_dir = vault_root.join("attachments");

    // Count total files for progress reporting
    let total: u32 = WalkDir::new(export_dir).min_depth(1)
        .into_iter().filter_map(|e| e.ok()).filter(|e| e.path().is_file()).count() as u32;
    let mut processed: u32 = 0;

    for entry in WalkDir::new(export_dir).min_depth(1) {
        let Ok(entry) = entry else { continue };
        let path = entry.path();
        if !path.is_file() {
            continue;
        }

        processed += 1;
        let file_name = path.file_name().and_then(|n| n.to_str()).unwrap_or("").to_string();
        app_handle.emit("import://progress", serde_json::json!({
            "current": processed, "total": total, "file": file_name,
        })).ok();

        let ext = path
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("")
            .to_lowercase();

        if ext == "md" {
            match process_md_file(path, vault_root, &attachments_dir) {
                Ok((true, att_errors)) => {
                    result.files_imported += 1;
                    result.errors.extend(att_errors);
                }
                Ok((false, att_errors)) => {
                    result.files_skipped += 1;
                    result.errors.extend(att_errors);
                }
                Err(e) => result.errors.push(e),
            }
        } else {
            // Top-level attachment files (not inside a note subfolder)
            // Check if parent is the export root (direct sibling of .md files).
            let parent = path.parent().unwrap_or(export_dir);
            if parent == export_dir {
                if let Some(err) = copy_attachment(path, &attachments_dir) {
                    result.errors.push(err);
                }
            }
            // Attachments inside note subfolders are handled by process_md_file.
        }
    }
}

/// Extract a zip archive into a subdirectory of the system temp folder.
/// Returns the path to the extraction directory; caller is responsible for cleanup.
fn extract_zip(zip_path: &Path) -> Result<PathBuf, CascadeError> {
    use std::io::BufReader;

    let file =
        fs::File::open(zip_path).map_err(|e| CascadeError::Import(format!("Open zip: {}", e)))?;
    let mut archive = zip::ZipArchive::new(BufReader::new(file))
        .map_err(|e| CascadeError::Import(format!("Read zip: {}", e)))?;

    // Use a unique subdirectory under the system temp dir.
    let tmp_path = std::env::temp_dir().join(format!(
        "bear_import_{}",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_nanos())
            .unwrap_or(0)
    ));
    fs::create_dir_all(&tmp_path)
        .map_err(|e| CascadeError::Import(format!("Create temp dir: {}", e)))?;

    for i in 0..archive.len() {
        let mut entry = archive
            .by_index(i)
            .map_err(|e| CascadeError::Import(format!("Zip entry {}: {}", i, e)))?;

        let out_path = match entry.enclosed_name() {
            Some(p) => tmp_path.join(p),
            None => continue,
        };

        if entry.is_dir() {
            fs::create_dir_all(&out_path)
                .map_err(|e| CascadeError::Import(format!("Create dir: {}", e)))?;
        } else {
            if let Some(parent) = out_path.parent() {
                fs::create_dir_all(parent)
                    .map_err(|e| CascadeError::Import(format!("Create dir: {}", e)))?;
            }
            let mut out_file = fs::File::create(&out_path)
                .map_err(|e| CascadeError::Import(format!("Create file: {}", e)))?;
            io::copy(&mut entry, &mut out_file)
                .map_err(|e| CascadeError::Import(format!("Extract: {}", e)))?;
        }
    }

    Ok(tmp_path)
}

#[tauri::command]
pub fn import_bear_export(
    app_handle: tauri::AppHandle,
    vault_root: String,
    export_path: String,
) -> Result<ImportResult, CascadeError> {
    let vault = PathBuf::from(&vault_root);
    if !vault.is_dir() {
        return Err(CascadeError::NotADirectory(vault_root));
    }

    fs::create_dir_all(vault.join("attachments"))
        .map_err(|e| CascadeError::Import(format!("Create attachments dir: {}", e)))?;

    let export = PathBuf::from(&export_path);
    let mut result = ImportResult {
        files_imported: 0,
        files_skipped: 0,
        errors: Vec::new(),
    };

    let lower = export_path.to_lowercase();
    if lower.ends_with(".zip") {
        // Extract zip to temp dir, process, then clean up.
        let tmp_path = extract_zip(&export)?;
        process_export_dir(&tmp_path, &vault, &mut result, &app_handle);
        // Best-effort cleanup of temp dir.
        let _ = fs::remove_dir_all(&tmp_path);
    } else if export.is_dir() {
        process_export_dir(&export, &vault, &mut result, &app_handle);
    } else {
        return Err(CascadeError::Import(format!(
            "export_path must be a .zip file or a directory, got: {}",
            export_path
        )));
    }

    Ok(result)
}
