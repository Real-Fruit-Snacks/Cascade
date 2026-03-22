use std::fs;
use std::path::Path;
use std::time::Instant;

use crate::error::CascadeError;
use crate::watcher::SuppressTimestamp;
use crate::VaultRoot;

use super::{get_canonical_root, validate_path_canonical};

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
