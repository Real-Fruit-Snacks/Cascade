use std::collections::HashMap;
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::time::{Instant, SystemTime, UNIX_EPOCH};

use sha2::{Digest, Sha256};

use crate::error::CascadeError;
use crate::types::FileEntry;
use crate::watcher::SuppressTimestamp;

use crate::{CachedTree, VaultRoot};

/// Get canonical root: prefer the cached AppState value, fall back to canonicalizing the string.
fn get_canonical_root(
    vault_root_str: &str,
    state: &tauri::State<VaultRoot>,
) -> Result<PathBuf, CascadeError> {
    let guard = state.inner().0.lock().unwrap_or_else(|e| e.into_inner());
    if let Some(cached) = guard.clone() {
        return Ok(cached);
    }
    drop(guard);
    Ok(PathBuf::from(vault_root_str).canonicalize()?)
}

/// Validate a path against a pre-canonicalized root (avoids repeated canonicalize syscalls).
pub(crate) fn validate_path_canonical(canonical_root: &Path, requested: &str) -> Result<PathBuf, CascadeError> {
    if requested.contains('\0') {
        return Err(CascadeError::InvalidPath("path contains null byte".to_string()));
    }

    let full_path = canonical_root.join(requested);
    let canonical_requested = if full_path.exists() {
        full_path.canonicalize()?
    } else {
        // Walk up from full_path to find the deepest existing ancestor,
        // canonicalize it, then re-append the non-existent segments.
        // This allows creating files at paths like "a/b/c/file.md" where
        // intermediate directories don't exist yet.
        let mut existing = full_path.as_path();
        let mut tail_segments: Vec<&std::ffi::OsStr> = Vec::new();
        loop {
            if existing.exists() {
                break;
            }
            if let Some(name) = existing.file_name() {
                tail_segments.push(name);
                existing = existing.parent().unwrap_or(canonical_root);
            } else {
                break;
            }
        }
        let canonical_base = existing.canonicalize()?;
        let mut result = canonical_base;
        for seg in tail_segments.into_iter().rev() {
            result = result.join(seg);
        }
        result
    };
    if !canonical_requested.starts_with(canonical_root) {
        return Err(CascadeError::PathTraversal {
            requested: canonical_requested.to_string_lossy().into_owned(),
            vault: canonical_root.to_string_lossy().into_owned(),
        });
    }

    if canonical_requested.exists() && canonical_requested.symlink_metadata()?.file_type().is_symlink() {
        return Err(CascadeError::InvalidPath("symlinks are not allowed".to_string()));
    }

    Ok(canonical_requested)
}


pub fn build_tree_pub(dir: &Path, vault_root: &Path) -> Vec<FileEntry> {
    build_tree(dir, vault_root)
}

fn build_tree(dir: &Path, vault_root: &Path) -> Vec<FileEntry> {
    let mut entries: Vec<FileEntry> = Vec::new();

    let read_dir = match fs::read_dir(dir) {
        Ok(rd) => rd,
        Err(_) => return entries,
    };

    let mut items: Vec<_> = read_dir.filter_map(|e| e.ok()).collect();
    items.sort_by_key(|e| {
        let is_file = e.file_type().map(|ft| ft.is_file()).unwrap_or(false);
        (is_file, e.file_name())
    });

    for entry in items {
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();

        // Skip dotfile directories and dotfiles
        if name.starts_with('.') {
            continue;
        }

        let is_dir = entry.file_type().map(|ft| ft.is_dir()).unwrap_or(false);
        let rel_path = path
            .strip_prefix(vault_root)
            .unwrap_or(&path)
            .to_string_lossy()
            .replace('\\', "/");

        let modified = entry
            .metadata()
            .and_then(|m| m.modified())
            .ok()
            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|d: std::time::Duration| d.as_secs_f64())
            .unwrap_or(0.0);

        let children = if is_dir {
            Some(build_tree(&path, vault_root))
        } else {
            None
        };

        entries.push(FileEntry {
            name,
            path: rel_path,
            is_dir,
            children,
            modified,
        });
    }

    entries
}

#[tauri::command]
pub async fn open_vault(
    path: String,
    app_handle: tauri::AppHandle,
    vault_root_state: tauri::State<'_, VaultRoot>,
    cached_tree: tauri::State<'_, CachedTree>,
) -> Result<Vec<FileEntry>, CascadeError> {
    let vault_root = PathBuf::from(&path);
    if !vault_root.is_dir() {
        return Err(CascadeError::NotADirectory(path.clone()));
    }
    // Cache the canonical root so all subsequent commands avoid repeated syscalls
    let canonical_root = vault_root.canonicalize()?;
    {
        let mut guard = vault_root_state.inner().0.lock().unwrap_or_else(|e| e.into_inner());
        *guard = Some(canonical_root.clone());
    }
    let root = canonical_root.clone();
    let tree = tauri::async_runtime::spawn_blocking(move || build_tree(&root, &root))
        .await
        .map_err(|e| CascadeError::Io(std::io::Error::other(e.to_string())))?;
    {
        let mut guard = cached_tree.inner().0.lock().unwrap_or_else(|e| e.into_inner());
        *guard = Some(tree.clone());
    }
    // Start watching the vault for external changes
    crate::watcher::start_watcher(app_handle, path);
    Ok(tree)
}

/// List files without restarting the file watcher.
/// Used by refreshTree to avoid tearing down and re-creating the watcher.
#[tauri::command]
pub async fn list_files(
    path: String,
    cached_tree: tauri::State<'_, CachedTree>,
) -> Result<Vec<FileEntry>, CascadeError> {
    let vault_root = PathBuf::from(&path);
    if !vault_root.is_dir() {
        return Err(CascadeError::NotADirectory(path));
    }
    let root = vault_root.clone();
    let tree = tauri::async_runtime::spawn_blocking(move || build_tree(&root, &root))
        .await
        .map_err(|e| CascadeError::Io(std::io::Error::other(e.to_string())))?;
    {
        let mut guard = cached_tree.inner().0.lock().unwrap_or_else(|e| e.into_inner());
        *guard = Some(tree.clone());
    }
    Ok(tree)
}

#[tauri::command]
pub fn read_file(
    vault_root: String,
    path: String,
    vault_root_state: tauri::State<VaultRoot>,
) -> Result<String, CascadeError> {
    let canonical_root = get_canonical_root(&vault_root, &vault_root_state)?;
    let validated = validate_path_canonical(&canonical_root, &path)?;
    Ok(fs::read_to_string(&validated)?)
}

#[tauri::command]
pub fn read_file_binary(
    vault_root: String,
    path: String,
    vault_root_state: tauri::State<VaultRoot>,
) -> Result<Vec<u8>, CascadeError> {
    let canonical_root = get_canonical_root(&vault_root, &vault_root_state)?;
    let validated = validate_path_canonical(&canonical_root, &path)?;
    Ok(fs::read(&validated)?)
}

#[tauri::command]
pub fn write_file(
    vault_root: String,
    path: String,
    content: String,
    suppress: tauri::State<SuppressTimestamp>,
    vault_root_state: tauri::State<VaultRoot>,
) -> Result<(), CascadeError> {
    let canonical_root = get_canonical_root(&vault_root, &vault_root_state)?;
    let validated = validate_path_canonical(&canonical_root, &path)?;
    // Save version snapshot before overwriting (best-effort)
    if validated.exists() {
        if let Ok(old_content) = fs::read_to_string(&validated) {
            let _ = save_version_snapshot_from_content(&canonical_root, &path, &old_content);
        }
    }
    fs::write(&validated, content)?;
    suppress.0.lock().unwrap_or_else(|e| e.into_inner()).insert(validated.clone(), Instant::now());
    Ok(())
}

#[tauri::command]
pub fn create_file(
    vault_root: String,
    path: String,
    suppress: tauri::State<SuppressTimestamp>,
    vault_root_state: tauri::State<VaultRoot>,
) -> Result<(), CascadeError> {
    let canonical_root = get_canonical_root(&vault_root, &vault_root_state)?;
    let validated = validate_path_canonical(&canonical_root, &path)?;
    if let Some(parent) = validated.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::File::create(&validated)?;
    suppress.0.lock().unwrap_or_else(|e| e.into_inner()).insert(validated.clone(), Instant::now());
    Ok(())
}

#[tauri::command]
pub fn delete_file(
    vault_root: String,
    path: String,
    suppress: tauri::State<SuppressTimestamp>,
    vault_root_state: tauri::State<VaultRoot>,
) -> Result<(), CascadeError> {
    let canonical_root = get_canonical_root(&vault_root, &vault_root_state)?;
    let validated = validate_path_canonical(&canonical_root, &path)?;
    if validated.is_dir() {
        fs::remove_dir_all(&validated)?;
    } else {
        fs::remove_file(&validated)?;
    }
    suppress.0.lock().unwrap_or_else(|e| e.into_inner()).insert(validated.clone(), Instant::now());
    Ok(())
}

/// Export writes to a user-selected path from the native save dialog.
/// The path is NOT validated against the vault root since exports intentionally
/// write outside the vault (e.g. to Desktop or Downloads).
#[tauri::command]
pub fn export_file(_vault_root: String, path: String, content: String) -> Result<(), CascadeError> {
    let dest = PathBuf::from(&path);
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
    for entry in walkdir::WalkDir::new(&base_dir).into_iter().filter_map(|e| e.ok()) {
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

#[tauri::command]
pub fn move_file(
    vault_root: String,
    src_path: String,
    dest_dir: String,
    suppress: tauri::State<SuppressTimestamp>,
    vault_root_state: tauri::State<VaultRoot>,
) -> Result<String, CascadeError> {
    let canonical_root = get_canonical_root(&vault_root, &vault_root_state)?;
    let validated_src = validate_path_canonical(&canonical_root, &src_path)?;
    let validated_dest_dir = validate_path_canonical(&canonical_root, &dest_dir)?;
    if !validated_dest_dir.is_dir() {
        return Err(CascadeError::NotADirectory(dest_dir));
    }
    let file_name = validated_src
        .file_name()
        .ok_or_else(|| CascadeError::InvalidPath("no filename".to_string()))?;
    let dest_path = validated_dest_dir.join(file_name);
    if dest_path.exists() {
        return Err(CascadeError::InvalidPath("destination already exists".to_string()));
    }
    fs::rename(&validated_src, &dest_path)?;
    {
        let mut guard = suppress.0.lock().unwrap_or_else(|e| e.into_inner());
        guard.insert(validated_src.clone(), Instant::now());
        guard.insert(dest_path.clone(), Instant::now());
    }
    let rel = dest_path
        .strip_prefix(&canonical_root)
        .unwrap_or(&dest_path)
        .to_string_lossy()
        .replace('\\', "/");
    Ok(rel)
}

const PLUGINS_DIR: &str = ".cascade/plugins";
const THEMES_DIR: &str = ".cascade/themes";
const TRASH_DIR: &str = ".trash";
const SETTINGS_DIR: &str = ".cascade";
const SETTINGS_FILE: &str = ".cascade/settings.json";

#[tauri::command]
pub fn trash_file(
    vault_root: String,
    path: String,
    suppress: tauri::State<SuppressTimestamp>,
    vault_root_state: tauri::State<VaultRoot>,
) -> Result<String, CascadeError> {
    let canonical_root = get_canonical_root(&vault_root, &vault_root_state)?;
    let validated = validate_path_canonical(&canonical_root, &path)?;
    let trash_dir = canonical_root.join(TRASH_DIR);
    fs::create_dir_all(&trash_dir)?;

    let file_name = validated.file_name()
        .ok_or_else(|| CascadeError::InvalidPath("no filename".to_string()))?;
    let mut dest = trash_dir.join(file_name);

    // Handle name collisions by appending timestamp
    if dest.exists() {
        let stem = dest.file_stem().unwrap_or_default().to_string_lossy().to_string();
        let ext = dest.extension().map(|e| format!(".{}", e.to_string_lossy())).unwrap_or_default();
        let timestamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis();
        dest = trash_dir.join(format!("{}.{}{}", stem, timestamp, ext));
    }

    fs::rename(&validated, &dest)?;
    suppress.0.lock().unwrap_or_else(|e| e.into_inner()).insert(validated.clone(), Instant::now());

    let rel = dest.strip_prefix(&canonical_root).unwrap_or(&dest)
        .to_string_lossy().replace('\\', "/");
    Ok(rel)
}

#[tauri::command]
pub fn read_vault_settings(
    vault_root: String,
    vault_root_state: tauri::State<VaultRoot>,
) -> Result<String, CascadeError> {
    let canonical_root = get_canonical_root(&vault_root, &vault_root_state)?;
    if !canonical_root.is_dir() {
        return Err(CascadeError::NotADirectory(vault_root));
    }
    let settings_path = canonical_root.join(SETTINGS_FILE);
    if settings_path.exists() {
        Ok(fs::read_to_string(&settings_path)?)
    } else {
        Ok("{}".to_string())
    }
}

#[tauri::command]
pub fn write_vault_settings(
    vault_root: String,
    settings: String,
    vault_root_state: tauri::State<VaultRoot>,
) -> Result<(), CascadeError> {
    let canonical_root = get_canonical_root(&vault_root, &vault_root_state)?;
    if !canonical_root.is_dir() {
        return Err(CascadeError::NotADirectory(vault_root));
    }
    let dir_path = canonical_root.join(SETTINGS_DIR);
    if !dir_path.exists() {
        fs::create_dir_all(&dir_path)?;
    }
    let settings_path = canonical_root.join(SETTINGS_FILE);
    fs::write(&settings_path, settings)?;
    Ok(())
}

const DICTIONARY_FILE: &str = ".cascade/dictionary.json";

#[tauri::command]
pub fn read_custom_dictionary(
    vault_root: String,
    vault_root_state: tauri::State<VaultRoot>,
) -> Result<Vec<String>, CascadeError> {
    let canonical_root = get_canonical_root(&vault_root, &vault_root_state)?;
    if !canonical_root.is_dir() {
        return Err(CascadeError::NotADirectory(vault_root));
    }
    let dict_path = canonical_root.join(DICTIONARY_FILE);
    if dict_path.exists() {
        let content = fs::read_to_string(&dict_path)?;
        let words: Vec<String> = serde_json::from_str(&content)
            .unwrap_or_default();
        Ok(words)
    } else {
        Ok(Vec::new())
    }
}

#[tauri::command]
pub fn write_custom_dictionary(
    vault_root: String,
    words: Vec<String>,
    vault_root_state: tauri::State<VaultRoot>,
) -> Result<(), CascadeError> {
    const MAX_WORDS: usize = 10_000;
    const MAX_WORD_LEN: usize = 100;

    let canonical_root = get_canonical_root(&vault_root, &vault_root_state)?;
    if !canonical_root.is_dir() {
        return Err(CascadeError::NotADirectory(vault_root));
    }
    // Filter out invalid words and enforce limits
    let validated: Vec<&String> = words.iter()
        .filter(|w| !w.is_empty() && w.len() <= MAX_WORD_LEN && w.chars().all(|c| c.is_alphabetic() || c == '\'' || c == '-'))
        .take(MAX_WORDS)
        .collect();
    let dir_path = canonical_root.join(SETTINGS_DIR);
    if !dir_path.exists() {
        fs::create_dir_all(&dir_path)?;
    }
    let dict_path = canonical_root.join(DICTIONARY_FILE);
    let json = serde_json::to_string_pretty(&validated)
        .map_err(|e| CascadeError::Io(std::io::Error::new(std::io::ErrorKind::Other, e)))?;
    fs::write(&dict_path, json)?;
    Ok(())
}

#[tauri::command]
pub fn save_attachment(
    vault_root: String,
    folder: String,
    filename: String,
    data: Vec<u8>,
    vault_root_state: tauri::State<VaultRoot>,
) -> Result<String, CascadeError> {
    let canonical_root = get_canonical_root(&vault_root, &vault_root_state)?;
    // Validate folder stays within vault
    let validated_dir = validate_path_canonical(&canonical_root, &folder)?;
    // Validate full destination path (folder + filename) before creating dirs
    let dest_rel = format!("{}/{}", folder.trim_end_matches('/'), filename);
    let validated_dest = validate_path_canonical(&canonical_root, &dest_rel)?;
    // validate_path_canonical already checks starts_with — no redundant check needed
    fs::create_dir_all(&validated_dir)?;
    fs::write(&validated_dest, data)?;
    let rel = validated_dest
        .strip_prefix(&canonical_root)
        .unwrap_or(&validated_dest)
        .to_string_lossy()
        .replace('\\', "/");
    Ok(rel)
}

#[tauri::command]
pub fn create_folder(
    vault_root: String,
    path: String,
    suppress: tauri::State<SuppressTimestamp>,
    vault_root_state: tauri::State<VaultRoot>,
) -> Result<(), CascadeError> {
    let canonical_root = get_canonical_root(&vault_root, &vault_root_state)?;
    let validated = validate_path_canonical(&canonical_root, &path)?;
    fs::create_dir_all(&validated)?;
    suppress.0.lock().unwrap_or_else(|e| e.into_inner()).insert(validated.clone(), Instant::now());
    Ok(())
}

#[tauri::command]
pub fn rename_file(
    vault_root: String,
    old_path: String,
    new_path: String,
    suppress: tauri::State<SuppressTimestamp>,
    vault_root_state: tauri::State<VaultRoot>,
) -> Result<(), CascadeError> {
    let canonical_root = get_canonical_root(&vault_root, &vault_root_state)?;
    let validated_old = validate_path_canonical(&canonical_root, &old_path)?;
    let validated_new = validate_path_canonical(&canonical_root, &new_path)?;
    if validated_new.exists() {
        return Err(CascadeError::InvalidPath("destination already exists".to_string()));
    }
    fs::rename(&validated_old, &validated_new)?;
    {
        let mut guard = suppress.0.lock().unwrap_or_else(|e| e.into_inner());
        guard.insert(validated_old.clone(), Instant::now());
        guard.insert(validated_new.clone(), Instant::now());
    }
    Ok(())
}

#[tauri::command]
pub fn list_plugins(
    vault_root: String,
    vault_root_state: tauri::State<VaultRoot>,
) -> Result<Vec<String>, CascadeError> {
    let canonical_root = get_canonical_root(&vault_root, &vault_root_state)?;
    if !canonical_root.is_dir() {
        return Err(CascadeError::NotADirectory(vault_root));
    }
    let plugins_dir = canonical_root.join(PLUGINS_DIR);
    if !plugins_dir.exists() {
        return Ok(Vec::new());
    }
    let mut manifests = Vec::new();
    let read_dir = fs::read_dir(&plugins_dir)?;
    for entry in read_dir.flatten() {
        if !entry.path().is_dir() {
            continue;
        }
        let manifest_path = entry.path().join("manifest.json");
        if manifest_path.exists() {
            if let Ok(content) = fs::read_to_string(&manifest_path) {
                manifests.push(content);
            }
        }
    }
    Ok(manifests)
}

// --- Custom Themes ---

#[tauri::command]
pub fn list_custom_themes(
    vault_root: String,
    vault_root_state: tauri::State<VaultRoot>,
) -> Result<Vec<String>, CascadeError> {
    let canonical_root = get_canonical_root(&vault_root, &vault_root_state)?;
    if !canonical_root.is_dir() {
        return Err(CascadeError::NotADirectory(vault_root));
    }
    let themes_dir = canonical_root.join(THEMES_DIR);
    if !themes_dir.exists() {
        return Ok(Vec::new());
    }
    let mut themes = Vec::new();
    let read_dir = fs::read_dir(&themes_dir)?;
    for entry in read_dir.flatten() {
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) == Some("json") {
            if let Ok(content) = fs::read_to_string(&path) {
                themes.push(content);
            }
        }
    }
    Ok(themes)
}

#[tauri::command]
pub fn save_custom_theme(
    vault_root: String,
    filename: String,
    content: String,
    vault_root_state: tauri::State<VaultRoot>,
) -> Result<(), CascadeError> {
    let canonical_root = get_canonical_root(&vault_root, &vault_root_state)?;
    if !canonical_root.is_dir() {
        return Err(CascadeError::NotADirectory(vault_root));
    }
    // Validate filename — only allow alphanumeric, hyphens, underscores
    if !filename.chars().all(|c| c.is_alphanumeric() || c == '-' || c == '_') {
        return Err(CascadeError::InvalidPath("theme filename must only contain alphanumeric characters, hyphens, and underscores".to_string()));
    }
    let themes_dir = canonical_root.join(THEMES_DIR);
    fs::create_dir_all(&themes_dir)?;
    let theme_path = themes_dir.join(format!("{}.json", filename));
    fs::write(&theme_path, content)?;
    Ok(())
}

#[tauri::command]
pub fn delete_custom_theme(
    vault_root: String,
    filename: String,
    vault_root_state: tauri::State<VaultRoot>,
) -> Result<(), CascadeError> {
    let canonical_root = get_canonical_root(&vault_root, &vault_root_state)?;
    if !canonical_root.is_dir() {
        return Err(CascadeError::NotADirectory(vault_root));
    }
    if !filename.chars().all(|c| c.is_alphanumeric() || c == '-' || c == '_') {
        return Err(CascadeError::InvalidPath("invalid theme filename".to_string()));
    }
    let theme_path = canonical_root.join(THEMES_DIR).join(format!("{}.json", filename));
    if theme_path.exists() {
        fs::remove_file(&theme_path)?;
    }
    Ok(())
}

// --- Template Folders ---

#[tauri::command]
pub fn copy_template_folder(
    vault_root: String,
    template_path: String,
    dest_path: String,
    suppress: tauri::State<SuppressTimestamp>,
    vault_root_state: tauri::State<VaultRoot>,
) -> Result<Vec<String>, CascadeError> {
    let canonical_root = get_canonical_root(&vault_root, &vault_root_state)?;
    let validated_src = validate_path_canonical(&canonical_root, &template_path)?;
    if !validated_src.is_dir() {
        return Err(CascadeError::NotADirectory(template_path));
    }
    let validated_dest = validate_path_canonical(&canonical_root, &dest_path)?;
    if validated_dest.exists() {
        return Err(CascadeError::InvalidPath("destination already exists".to_string()));
    }

    let mut created_files = Vec::new();
    copy_dir_recursive(&validated_src, &validated_dest, &canonical_root, &mut created_files)?;
    suppress.0.lock().unwrap_or_else(|e| e.into_inner()).insert(validated_dest.clone(), Instant::now());
    Ok(created_files)
}

fn copy_dir_recursive(
    src: &Path,
    dest: &Path,
    vault_root: &Path,
    created_files: &mut Vec<String>,
) -> Result<(), CascadeError> {
    fs::create_dir_all(dest)?;

    let mut items: Vec<_> = fs::read_dir(src)?.filter_map(|e| e.ok()).collect();
    items.sort_by_key(|e| e.file_name());

    for entry in items {
        let name = entry.file_name();
        let name_str = name.to_string_lossy();
        // Skip dotfiles
        if name_str.starts_with('.') {
            continue;
        }
        let src_path = entry.path();
        let dest_path = dest.join(&name);

        if src_path.is_dir() {
            copy_dir_recursive(&src_path, &dest_path, vault_root, created_files)?;
        } else {
            fs::copy(&src_path, &dest_path)?;
            let rel = dest_path
                .strip_prefix(vault_root)
                .unwrap_or(&dest_path)
                .to_string_lossy()
                .replace('\\', "/");
            created_files.push(rel);
        }
    }
    Ok(())
}

// --- Version History ---

fn save_version_snapshot_from_content(canonical_root: &Path, rel_path: &str, old_content: &str) -> Result<(), CascadeError> {
    if old_content.is_empty() {
        return Ok(());
    }
    let sanitized = rel_path.replace('\\', "/");
    let history_dir = canonical_root.join(".cascade").join("history").join(&sanitized);
    fs::create_dir_all(&history_dir)?;
    let ts = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    let snapshot_path = history_dir.join(format!("{}.md", ts));
    fs::write(&snapshot_path, old_content)?;

    // Keep at most 50 snapshots per file — prune oldest
    let mut entries: Vec<_> = fs::read_dir(&history_dir)?
        .filter_map(|e| e.ok())
        .filter(|e| e.path().extension().and_then(|x| x.to_str()) == Some("md"))
        .collect();
    if entries.len() > 50 {
        entries.sort_by_key(|e| e.file_name());
        for entry in entries.iter().take(entries.len() - 50) {
            let _ = fs::remove_file(entry.path());
        }
    }
    Ok(())
}


#[derive(serde::Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct HistoryEntry {
    pub timestamp: u64,
    pub size: u64,
}

#[tauri::command]
pub fn list_file_history(
    vault_root: String,
    path: String,
    vault_root_state: tauri::State<VaultRoot>,
) -> Result<Vec<HistoryEntry>, CascadeError> {
    let canonical_root = get_canonical_root(&vault_root, &vault_root_state)?;
    let sanitized = path.replace('\\', "/");
    let history_dir = canonical_root.join(".cascade").join("history").join(&sanitized);
    if !history_dir.is_dir() {
        return Ok(vec![]);
    }
    let mut entries: Vec<HistoryEntry> = fs::read_dir(&history_dir)?
        .filter_map(|e| e.ok())
        .filter_map(|e| {
            let name = e.file_name().to_string_lossy().replace(".md", "");
            let ts: u64 = name.parse().ok()?;
            let size = e.metadata().ok()?.len();
            Some(HistoryEntry { timestamp: ts, size })
        })
        .collect();
    entries.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));
    Ok(entries)
}

#[tauri::command]
pub fn read_file_history(
    vault_root: String,
    path: String,
    timestamp: u64,
    vault_root_state: tauri::State<VaultRoot>,
) -> Result<String, CascadeError> {
    let canonical_root = get_canonical_root(&vault_root, &vault_root_state)?;
    let sanitized = path.replace('\\', "/");
    let history_dir = canonical_root.join(".cascade").join("history").join(&sanitized);
    let snapshot_path = history_dir.join(format!("{}.md", timestamp));
    if !snapshot_path.exists() {
        return Err(CascadeError::InvalidPath("history entry not found".to_string()));
    }
    // Ensure snapshot is within history dir (prevent traversal via timestamp)
    let canonical_snapshot = snapshot_path.canonicalize()?;
    let canonical_history = history_dir.canonicalize()?;
    if !canonical_snapshot.starts_with(&canonical_history) {
        return Err(CascadeError::InvalidPath("invalid history path".to_string()));
    }
    Ok(fs::read_to_string(&canonical_snapshot)?)
}

#[tauri::command]
pub fn compute_plugin_checksums(
    vault_root: String,
    plugin_id: String,
    vault_root_state: tauri::State<VaultRoot>,
) -> Result<HashMap<String, String>, CascadeError> {
    let canonical_root = get_canonical_root(&vault_root, &vault_root_state)?;
    let plugin_dir = canonical_root.join(".cascade").join("plugins").join(&plugin_id);
    if !plugin_dir.is_dir() {
        return Err(CascadeError::NotADirectory(plugin_dir.to_string_lossy().into()));
    }
    let mut checksums = HashMap::new();
    for entry in walkdir::WalkDir::new(&plugin_dir).into_iter().filter_map(|e| e.ok()) {
        if entry.file_type().is_file() {
            let path = entry.path();
            let rel = path.strip_prefix(&plugin_dir).unwrap().to_string_lossy().replace('\\', "/");
            if rel == ".integrity.json" {
                continue;
            }
            let bytes = fs::read(path)?;
            let hash = format!("sha256:{:x}", Sha256::digest(&bytes));
            checksums.insert(rel, hash);
        }
    }
    Ok(checksums)
}

#[tauri::command]
pub fn write_integrity_file(
    vault_root: String,
    plugin_id: String,
    installed_from: String,
    checksums: HashMap<String, String>,
    vault_root_state: tauri::State<VaultRoot>,
) -> Result<(), CascadeError> {
    let canonical_root = get_canonical_root(&vault_root, &vault_root_state)?;
    let integrity_path = canonical_root
        .join(".cascade")
        .join("plugins")
        .join(&plugin_id)
        .join(".integrity.json");
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs();
    let data = serde_json::json!({
        "installedFrom": installed_from,
        "installedAt": now,
        "files": checksums
    });
    fs::write(&integrity_path, serde_json::to_string_pretty(&data).unwrap())?;
    Ok(())
}

#[tauri::command]
pub fn extract_plugin_zip(
    vault_root: String,
    plugin_id: String,
    data: Vec<u8>,
    vault_root_state: tauri::State<VaultRoot>,
) -> Result<(), CascadeError> {
    let canonical_root = get_canonical_root(&vault_root, &vault_root_state)?;
    // Validate plugin_id is safe (alphanumeric, hyphens, underscores only)
    if !plugin_id.chars().all(|c| c.is_alphanumeric() || c == '-' || c == '_') {
        return Err(CascadeError::InvalidPath("Invalid plugin ID".into()));
    }
    let plugin_dir = canonical_root.join(".cascade").join("plugins").join(&plugin_id);
    if plugin_dir.exists() {
        fs::remove_dir_all(&plugin_dir)?;
    }
    fs::create_dir_all(&plugin_dir)?;

    let cursor = std::io::Cursor::new(data);
    let mut archive = zip::ZipArchive::new(cursor)?;
    for i in 0..archive.len() {
        let mut file = archive.by_index(i)?;
        let name = file.name().to_string();
        if name.contains("..") {
            continue; // path traversal prevention
        }
        let dest = plugin_dir.join(&name);
        if file.is_dir() {
            fs::create_dir_all(&dest)?;
        } else {
            if let Some(parent) = dest.parent() {
                fs::create_dir_all(parent)?;
            }
            let mut out = fs::File::create(&dest)?;
            std::io::copy(&mut file, &mut out)?;
        }
    }
    Ok(())
}

#[tauri::command]
pub fn verify_plugin_integrity(
    vault_root: String,
    plugin_id: String,
    vault_root_state: tauri::State<VaultRoot>,
) -> Result<bool, CascadeError> {
    let canonical_root = get_canonical_root(&vault_root, &vault_root_state)?;
    let integrity_path = canonical_root
        .join(".cascade")
        .join("plugins")
        .join(&plugin_id)
        .join(".integrity.json");
    if !integrity_path.exists() {
        return Ok(true); // No integrity file = dev plugin, allow
    }
    let raw = fs::read_to_string(&integrity_path)?;
    let data: serde_json::Value = serde_json::from_str(&raw)
        .map_err(|e| CascadeError::InvalidPath(format!("malformed integrity file: {}", e)))?;
    let files = data["files"]
        .as_object()
        .ok_or_else(|| CascadeError::InvalidPath("malformed integrity file: missing files".into()))?;
    let plugin_dir = canonical_root.join(".cascade").join("plugins").join(&plugin_id);
    for (rel_path, expected_hash) in files {
        let abs_path = plugin_dir.join(rel_path);
        if !abs_path.exists() {
            return Ok(false);
        }
        let bytes = fs::read(&abs_path)?;
        let actual = format!("sha256:{:x}", Sha256::digest(&bytes));
        if actual != expected_hash.as_str().unwrap_or("") {
            return Ok(false);
        }
    }
    Ok(true)
}
