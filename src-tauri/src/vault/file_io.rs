use std::fs;
use std::time::Instant;

use crate::error::CascadeError;
use crate::watcher::SuppressTimestamp;
use crate::VaultRoot;

use super::{get_canonical_root, validate_path_canonical};
use super::history::save_version_snapshot_from_content;

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
