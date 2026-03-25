use std::fs;
use std::time::Instant;

use crate::error::CascadeError;
use crate::watcher::SuppressTimestamp;
use crate::VaultRoot;

use super::{get_canonical_root, validate_path_canonical, TRASH_DIR};

#[derive(Debug, serde::Serialize, Clone)]
pub struct TrashEntry {
    pub name: String,
    pub size: u64,
    pub trashed_at: u64,
}

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
pub fn list_trash(
    vault_root: String,
    vault_root_state: tauri::State<VaultRoot>,
) -> Result<Vec<TrashEntry>, CascadeError> {
    let canonical_root = get_canonical_root(&vault_root, &vault_root_state)?;
    let trash_dir = canonical_root.join(TRASH_DIR);
    if !trash_dir.exists() {
        return Ok(vec![]);
    }
    let mut entries = Vec::new();
    for entry in fs::read_dir(&trash_dir)? {
        let entry = entry?;
        let meta = entry.metadata()?;
        let name = entry.file_name().to_string_lossy().to_string();
        let trashed_at = meta.modified()
            .unwrap_or(std::time::SystemTime::UNIX_EPOCH)
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();
        let size = if meta.is_dir() {
            walkdir::WalkDir::new(entry.path())
                .into_iter()
                .filter_map(|e| e.ok())
                .filter(|e| e.file_type().is_file())
                .map(|e| e.metadata().map(|m| m.len()).unwrap_or(0))
                .sum()
        } else {
            meta.len()
        };
        entries.push(TrashEntry { name, size, trashed_at });
    }
    entries.sort_by(|a, b| b.trashed_at.cmp(&a.trashed_at));
    Ok(entries)
}

#[tauri::command]
pub fn restore_from_trash(
    vault_root: String,
    name: String,
    vault_root_state: tauri::State<VaultRoot>,
) -> Result<(), CascadeError> {
    // Reject names with path separators or traversal components
    if name.contains('/') || name.contains('\\') || name.contains("..") || name.is_empty() {
        return Err(CascadeError::InvalidPath("invalid trash entry name".to_string()));
    }
    let canonical_root = get_canonical_root(&vault_root, &vault_root_state)?;
    let trash_dir = canonical_root.join(TRASH_DIR);
    let source = trash_dir.join(&name);
    if !source.starts_with(&trash_dir) {
        return Err(CascadeError::PathTraversal {
            requested: name.clone(),
            vault: trash_dir.to_string_lossy().into_owned(),
        });
    }
    if !source.exists() {
        return Err(CascadeError::InvalidPath(format!("not found in trash: {}", name)));
    }
    let dest_name = strip_trash_timestamp(&name);
    let mut dest = canonical_root.join(&dest_name);
    if dest.exists() {
        let stem = dest.file_stem().unwrap_or_default().to_string_lossy().to_string();
        let ext = dest.extension().map(|e| format!(".{}", e.to_string_lossy())).unwrap_or_default();
        let mut counter = 1;
        loop {
            dest = canonical_root.join(format!("{} ({}){}", stem, counter, ext));
            if !dest.exists() { break; }
            counter += 1;
            if counter > 1000 {
                return Err(CascadeError::InvalidPath("too many name collisions during restore".to_string()));
            }
        }
    }
    fs::rename(&source, &dest)?;
    Ok(())
}

#[tauri::command]
pub fn delete_from_trash(
    vault_root: String,
    name: String,
    vault_root_state: tauri::State<VaultRoot>,
) -> Result<(), CascadeError> {
    // Reject names with path separators or traversal components
    if name.contains('/') || name.contains('\\') || name.contains("..") || name.is_empty() {
        return Err(CascadeError::InvalidPath("invalid trash entry name".to_string()));
    }
    let canonical_root = get_canonical_root(&vault_root, &vault_root_state)?;
    let trash_dir = canonical_root.join(TRASH_DIR);
    let target = trash_dir.join(&name);
    if !target.starts_with(&trash_dir) {
        return Err(CascadeError::PathTraversal {
            requested: name.clone(),
            vault: trash_dir.to_string_lossy().into_owned(),
        });
    }
    if !target.exists() {
        return Err(CascadeError::InvalidPath(format!("not found in trash: {}", name)));
    }
    if target.is_dir() {
        fs::remove_dir_all(&target)?;
    } else {
        fs::remove_file(&target)?;
    }
    Ok(())
}

#[tauri::command]
pub fn empty_trash(
    vault_root: String,
    vault_root_state: tauri::State<VaultRoot>,
) -> Result<(), CascadeError> {
    let canonical_root = get_canonical_root(&vault_root, &vault_root_state)?;
    let trash_dir = canonical_root.join(TRASH_DIR);
    if trash_dir.exists() {
        fs::remove_dir_all(&trash_dir)?;
        fs::create_dir_all(&trash_dir)?;
    }
    Ok(())
}

/// Strip the timestamp collision suffix from a trash file name.
/// e.g., "notes.1234567890123.md" -> "notes.md", "readme.md" -> "readme.md"
pub(super) fn strip_trash_timestamp(name: &str) -> String {
    if let Some(dot_ext) = name.rfind('.') {
        let before_ext = &name[..dot_ext];
        if let Some(dot_ts) = before_ext.rfind('.') {
            let candidate = &before_ext[dot_ts + 1..];
            if candidate.len() >= 10 && candidate.chars().all(|c| c.is_ascii_digit()) {
                return format!("{}{}", &before_ext[..dot_ts], &name[dot_ext..]);
            }
        }
    }
    name.to_string()
}
