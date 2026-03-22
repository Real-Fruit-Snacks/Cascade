use std::fs;

use crate::error::CascadeError;
use crate::VaultRoot;

use super::{get_canonical_root, THEMES_DIR};

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
