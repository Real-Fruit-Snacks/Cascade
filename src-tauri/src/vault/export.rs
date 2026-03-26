use std::fs;
use std::io::Write;
use std::path::PathBuf;

use crate::error::CascadeError;
use crate::VaultRoot;

use super::{get_canonical_root, validate_path_canonical};

/// Export writes to a user-selected path from the native save dialog.
/// The path is NOT validated against the vault root since exports intentionally
/// write outside the vault (e.g. to Desktop or Downloads).
#[tauri::command]
pub fn export_file(_vault_root: String, path: String, content: String) -> Result<(), CascadeError> {
    let dest = PathBuf::from(&path);
    if !dest.is_absolute() {
        return Err(CascadeError::InvalidPath("export path must be absolute".into()));
    }
    // Only allow writing supported export formats
    match dest.extension().and_then(|e| e.to_str()) {
        Some("html") | Some("htm") | Some("md") | Some("docx") | Some("zip") => {}
        _ => return Err(CascadeError::InvalidPath("export only supports .html/.md/.docx/.zip files".to_string())),
    }
    // Verify parent directory exists
    if let Some(parent) = dest.parent() {
        if !parent.is_dir() {
            return Err(CascadeError::NotADirectory(parent.to_string_lossy().into_owned()));
        }
    }
    fs::write(&dest, content)?;
    Ok(())
}

#[tauri::command]
pub fn export_binary(path: String, data: Vec<u8>) -> Result<(), CascadeError> {
    let dest = PathBuf::from(&path);
    if !dest.is_absolute() {
        return Err(CascadeError::InvalidPath("export path must be absolute".into()));
    }
    match dest.extension().and_then(|e| e.to_str()) {
        Some("docx") | Some("zip") => {}
        _ => return Err(CascadeError::InvalidPath("binary export only supports .docx/.zip".to_string())),
    }
    if let Some(parent) = dest.parent() {
        if !parent.is_dir() {
            return Err(CascadeError::NotADirectory(parent.to_string_lossy().into_owned()));
        }
    }
    fs::write(&dest, &data)?;
    Ok(())
}

#[tauri::command]
pub fn batch_export(vault_root: String, folder_path: String, format: String, output_path: String, vault_root_state: tauri::State<VaultRoot>) -> Result<usize, CascadeError> {
    let canonical_root = get_canonical_root(&vault_root, &vault_root_state)?;

    // Determine the base directory to export from
    let base_dir = if folder_path.is_empty() {
        canonical_root.clone()
    } else {
        validate_path_canonical(&canonical_root, &folder_path)?
    };

    if !base_dir.is_dir() {
        return Err(CascadeError::NotADirectory(base_dir.to_string_lossy().into_owned()));
    }

    let dest = PathBuf::from(&output_path);
    match dest.extension().and_then(|e| e.to_str()) {
        Some("zip") => {}
        _ => return Err(CascadeError::InvalidPath("batch export only supports .zip output".to_string())),
    }
    if let Some(parent) = dest.parent() {
        if !parent.is_dir() {
            return Err(CascadeError::NotADirectory(parent.to_string_lossy().into_owned()));
        }
    }

    let file = fs::File::create(&dest)?;
    let mut zip_writer = zip::ZipWriter::new(file);
    let options = zip::write::SimpleFileOptions::default().compression_method(zip::CompressionMethod::Deflated);

    let mut count: usize = 0;
    for entry in walkdir::WalkDir::new(&base_dir).into_iter().filter_entry(|e| !e.file_name().to_string_lossy().starts_with('.')).filter_map(|e| e.ok()) {
        let path = entry.path();
        if path.is_file() && path.extension().and_then(|e| e.to_str()) == Some("md") {
            let relative = path.strip_prefix(&base_dir).unwrap_or(path);
            let zip_path = relative.to_string_lossy().replace('\\', "/");

            let content = fs::read_to_string(path)?;

            if format == "html" {
                // Basic markdown wrapping for HTML - simple conversion
                let html_content = format!(
                    "<!DOCTYPE html><html><head><meta charset=\"UTF-8\"><title>{}</title><style>body{{font-family:sans-serif;max-width:800px;margin:0 auto;padding:2rem;line-height:1.7}}</style></head><body><pre>{}</pre></body></html>",
                    zip_path,
                    content.replace('&', "&amp;").replace('<', "&lt;").replace('>', "&gt;")
                );
                let html_path = zip_path.replace(".md", ".html");
                zip_writer.start_file(&html_path, options)?;
                zip_writer.write_all(html_content.as_bytes())?;
            } else {
                // Raw markdown
                zip_writer.start_file(&zip_path, options)?;
                zip_writer.write_all(content.as_bytes())?;
            }
            count += 1;
        }
    }

    zip_writer.finish()?;
    Ok(count)
}
