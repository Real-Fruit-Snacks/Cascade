use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};
use chrono::Local;

/// Get the sync log file path for a vault.
pub fn log_path(vault_path: &Path) -> PathBuf {
    vault_path.join(".cascade").join("logs").join("sync.log")
}

/// Write a log entry to the sync log file.
pub fn log(vault_path: &Path, level: &str, message: &str) {
    let path = log_path(vault_path);
    if let Some(parent) = path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    if let Ok(mut file) = OpenOptions::new().create(true).append(true).open(&path) {
        let timestamp = Local::now().format("%Y-%m-%d %H:%M:%S");
        let _ = writeln!(file, "[{timestamp}] [{level}] {message}");
    }
}

/// Convenience functions
pub fn info(vault_path: &Path, message: &str) {
    log(vault_path, "INFO", message);
}

pub fn error(vault_path: &Path, message: &str) {
    log(vault_path, "ERROR", message);
}

pub fn debug(vault_path: &Path, message: &str) {
    log(vault_path, "DEBUG", message);
}

/// Tauri command so the frontend can write to the same sync log.
#[tauri::command]
pub fn write_sync_log(vault_path: String, level: String, message: String) {
    log(Path::new(&vault_path), &level, &message);
}
