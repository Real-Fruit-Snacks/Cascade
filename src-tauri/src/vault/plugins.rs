use std::collections::HashMap;
use std::fs;
use std::time::{SystemTime, UNIX_EPOCH};

use sha2::{Digest, Sha256};

use crate::error::CascadeError;
use crate::VaultRoot;

use super::{get_canonical_root, PLUGINS_DIR};

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
            let rel = path.strip_prefix(&plugin_dir)
                .map_err(|_| CascadeError::InvalidPath("path outside plugin dir".to_string()))?
                .to_string_lossy().replace('\\', "/");
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
        .unwrap_or_default()
        .as_secs();
    let data = serde_json::json!({
        "installedFrom": installed_from,
        "installedAt": now,
        "files": checksums
    });
    let json = serde_json::to_string_pretty(&data)
        .map_err(|e| CascadeError::Io(std::io::Error::new(std::io::ErrorKind::Other, e)))?;
    fs::write(&integrity_path, json)?;
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
        if name.contains("..") || name.starts_with('/') || name.starts_with('\\') {
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
