use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};
use chrono::Local;

/// Get the sync log file path for a vault.
pub fn log_path(vault_path: &Path) -> PathBuf {
    vault_path.join(".cascade").join("logs").join("sync.log")
}

const MAX_LOG_SIZE: u64 = 1_048_576; // 1MB

/// Write a log entry to the sync log file.
pub fn log(vault_path: &Path, level: &str, message: &str) {
    let path = log_path(vault_path);
    if let Some(parent) = path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    // Rotate log if it exceeds 1MB — keep last 500 lines
    if let Ok(meta) = fs::metadata(&path) {
        if meta.len() > MAX_LOG_SIZE {
            if let Ok(content) = fs::read_to_string(&path) {
                let lines: Vec<&str> = content.lines().collect();
                let keep = lines.len().saturating_sub(500);
                let _ = fs::write(&path, lines[keep..].join("\n") + "\n");
            }
        }
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
