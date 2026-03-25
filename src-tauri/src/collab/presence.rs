use serde::{Deserialize, Serialize};
use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};

pub const COLLAB_FILE: &str = ".cascade/collab.json";
pub const HEARTBEAT_STALE_MS: u128 = 15_000;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PresenceInfo {
    pub host: String,
    pub port: u16,
    pub started_at: u128,
    pub heartbeat: u128,
}

pub fn now_ms() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis()
}

pub fn read_presence(vault_root: &Path) -> Option<PresenceInfo> {
    let path = vault_root.join(COLLAB_FILE);
    let contents = std::fs::read_to_string(&path).ok()?;
    serde_json::from_str(&contents).ok()
}

pub fn has_fresh_host(vault_root: &Path) -> Option<PresenceInfo> {
    let info = read_presence(vault_root)?;
    let age = now_ms().saturating_sub(info.heartbeat);
    if age < HEARTBEAT_STALE_MS {
        Some(info)
    } else {
        None
    }
}

pub fn write_presence(vault_root: &Path, host_ip: &str, port: u16) -> Result<(), String> {
    let path = vault_root.join(COLLAB_FILE);

    // Preserve started_at if updating our own entry
    let started_at = if let Some(existing) = read_presence(vault_root) {
        if existing.host == host_ip && existing.port == port {
            existing.started_at
        } else {
            now_ms()
        }
    } else {
        now_ms()
    };

    // Ensure parent directory exists
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create .cascade directory: {}", e))?;
    }

    let info = PresenceInfo {
        host: host_ip.to_string(),
        port,
        started_at,
        heartbeat: now_ms(),
    };

    let json = serde_json::to_string_pretty(&info)
        .map_err(|e| format!("Failed to serialize presence: {}", e))?;

    std::fs::write(&path, json)
        .map_err(|e| format!("Failed to write presence file: {}", e))?;

    Ok(())
}

pub fn update_heartbeat(vault_root: &Path) -> Result<(), String> {
    let path = vault_root.join(COLLAB_FILE);

    let mut info = read_presence(vault_root)
        .ok_or_else(|| "No presence file to update".to_string())?;

    info.heartbeat = now_ms();

    let json = serde_json::to_string_pretty(&info)
        .map_err(|e| format!("Failed to serialize presence: {}", e))?;

    std::fs::write(&path, json)
        .map_err(|e| format!("Failed to write presence file: {}", e))?;

    Ok(())
}

pub fn delete_presence(vault_root: &Path) {
    let path = vault_root.join(COLLAB_FILE);
    let _ = std::fs::remove_file(&path);
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    fn make_temp_vault() -> TempDir {
        let dir = TempDir::new().unwrap();
        std::fs::create_dir_all(dir.path().join(".cascade")).unwrap();
        dir
    }

    #[test]
    fn test_write_read_roundtrip() {
        let dir = make_temp_vault();
        write_presence(dir.path(), "192.168.1.10", 9000).unwrap();
        let info = read_presence(dir.path()).unwrap();
        assert_eq!(info.host, "192.168.1.10");
        assert_eq!(info.port, 9000);
        assert!(info.started_at > 0);
        assert!(info.heartbeat > 0);
    }

    #[test]
    fn test_fresh_detection() {
        let dir = make_temp_vault();
        write_presence(dir.path(), "192.168.1.10", 9000).unwrap();
        let info = has_fresh_host(dir.path());
        assert!(info.is_some());
    }

    #[test]
    fn test_stale_detection() {
        let dir = make_temp_vault();
        // Write a presence with a very old heartbeat
        let stale_info = PresenceInfo {
            host: "192.168.1.10".to_string(),
            port: 9000,
            started_at: 1000,
            heartbeat: 1000, // epoch + 1s, definitely stale
        };
        let path = dir.path().join(COLLAB_FILE);
        std::fs::write(&path, serde_json::to_string_pretty(&stale_info).unwrap()).unwrap();

        let result = has_fresh_host(dir.path());
        assert!(result.is_none(), "Expected stale host to return None");
    }

    #[test]
    fn test_delete_presence() {
        let dir = make_temp_vault();
        write_presence(dir.path(), "192.168.1.10", 9000).unwrap();
        assert!(read_presence(dir.path()).is_some());
        delete_presence(dir.path());
        assert!(read_presence(dir.path()).is_none());
    }

    #[test]
    fn test_is_our_presence() {
        let dir = make_temp_vault();
        write_presence(dir.path(), "192.168.1.10", 9000).unwrap();
        assert!(is_our_presence(dir.path(), "192.168.1.10", 9000));
        assert!(!is_our_presence(dir.path(), "192.168.1.11", 9000));
        assert!(!is_our_presence(dir.path(), "192.168.1.10", 9001));
    }

    #[test]
    fn test_update_heartbeat() {
        let dir = make_temp_vault();
        write_presence(dir.path(), "192.168.1.10", 9000).unwrap();
        let before = read_presence(dir.path()).unwrap().heartbeat;
        // Small sleep to ensure time advances
        std::thread::sleep(std::time::Duration::from_millis(5));
        update_heartbeat(dir.path()).unwrap();
        let after = read_presence(dir.path()).unwrap().heartbeat;
        assert!(after >= before);
    }

    #[test]
    fn test_preserve_started_at_on_update() {
        let dir = make_temp_vault();
        write_presence(dir.path(), "192.168.1.10", 9000).unwrap();
        let original_started_at = read_presence(dir.path()).unwrap().started_at;
        std::thread::sleep(std::time::Duration::from_millis(5));
        write_presence(dir.path(), "192.168.1.10", 9000).unwrap();
        let new_started_at = read_presence(dir.path()).unwrap().started_at;
        assert_eq!(original_started_at, new_started_at);
    }

    #[test]
    fn test_no_presence_returns_none() {
        let dir = make_temp_vault();
        assert!(read_presence(dir.path()).is_none());
        assert!(has_fresh_host(dir.path()).is_none());
    }
}
