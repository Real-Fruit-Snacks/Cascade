use std::fs;
use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};

use crate::error::CascadeError;
use crate::VaultRoot;

use super::get_canonical_root;

pub(crate) fn save_version_snapshot_from_content(canonical_root: &Path, rel_path: &str, old_content: &str) -> Result<(), CascadeError> {
    if old_content.is_empty() {
        return Ok(());
    }
    let sanitized = rel_path.replace('\\', "/");
    if sanitized.contains("..") || sanitized.starts_with('/') {
        return Err(CascadeError::InvalidPath("invalid history path".to_string()));
    }
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
    // Validate path to prevent traversal out of history directory
    let sanitized = path.replace('\\', "/");
    if sanitized.contains("..") || sanitized.starts_with('/') {
        return Err(CascadeError::InvalidPath("invalid history path".to_string()));
    }
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
