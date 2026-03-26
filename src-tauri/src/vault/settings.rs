use std::fs;

use crate::error::CascadeError;
use crate::VaultRoot;

use super::{get_canonical_root, validate_path_canonical, SETTINGS_DIR, SETTINGS_FILE};

const DICTIONARY_FILE: &str = ".cascade/dictionary.json";

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
    serde_json::from_str::<serde_json::Value>(&settings)
        .map_err(|e| CascadeError::Io(std::io::Error::new(std::io::ErrorKind::InvalidData, e)))?;
    fs::write(&settings_path, settings)?;
    Ok(())
}

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
        .map_err(|e| CascadeError::Io(std::io::Error::other(e)))?;
    fs::write(&dict_path, json)?;
    Ok(())
}

#[tauri::command]
pub fn read_settings_file(
    vault_root: String,
    relative_path: String,
    vault_root_state: tauri::State<VaultRoot>,
) -> Result<String, CascadeError> {
    let canonical_root = get_canonical_root(&vault_root, &vault_root_state)?;
    if !canonical_root.is_dir() {
        return Err(CascadeError::NotADirectory(vault_root));
    }
    let file_path = validate_path_canonical(&canonical_root, &relative_path)?;
    if file_path.exists() {
        Ok(fs::read_to_string(&file_path)?)
    } else {
        Ok("{}".to_string())
    }
}

#[tauri::command]
pub fn write_settings_file(
    vault_root: String,
    relative_path: String,
    settings: String,
    vault_root_state: tauri::State<VaultRoot>,
) -> Result<(), CascadeError> {
    let canonical_root = get_canonical_root(&vault_root, &vault_root_state)?;
    if !canonical_root.is_dir() {
        return Err(CascadeError::NotADirectory(vault_root));
    }
    if !relative_path.starts_with(".cascade/") && !relative_path.starts_with(".cascade\\") {
        return Err(CascadeError::InvalidPath("settings must be in .cascade/ directory".into()));
    }
    let file_path = validate_path_canonical(&canonical_root, &relative_path)?;
    if let Some(parent) = file_path.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent)?;
        }
    }
    fs::write(&file_path, settings)?;
    Ok(())
}

#[tauri::command]
pub fn list_settings_profiles(
    vault_root: String,
    vault_root_state: tauri::State<VaultRoot>,
) -> Result<Vec<String>, CascadeError> {
    let canonical_root = get_canonical_root(&vault_root, &vault_root_state)?;
    if !canonical_root.is_dir() {
        return Err(CascadeError::NotADirectory(vault_root));
    }
    let settings_dir = canonical_root.join(SETTINGS_DIR);
    if !settings_dir.exists() {
        return Ok(Vec::new());
    }
    let mut profiles: Vec<String> = fs::read_dir(&settings_dir)?
        .filter_map(|e| e.ok())
        .filter_map(|e| {
            let name = e.file_name().to_string_lossy().to_string();
            if e.file_type().map(|ft| ft.is_file()).unwrap_or(false)
                && name.starts_with("settings")
                && name.ends_with(".json")
            {
                Some(name)
            } else {
                None
            }
        })
        .collect();
    profiles.sort();
    Ok(profiles)
}
