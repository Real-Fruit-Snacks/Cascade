use std::path::PathBuf;
use std::sync::Arc;
use tauri::AppHandle;

use super::{
    CollabConfig, CollabConfigInner, CollabRole, CollabServerState, CollabStatus, HeartbeatHandle,
};
use crate::collab::presence;
use crate::collab::server::RelayServer;

#[tauri::command]
pub async fn start_collab(
    app_handle: AppHandle,
    password: String,
    server_state: tauri::State<'_, CollabServerState>,
    config_state: tauri::State<'_, CollabConfig>,
    heartbeat_state: tauri::State<'_, HeartbeatHandle>,
    vault_root: tauri::State<'_, crate::VaultRoot>,
) -> Result<CollabStatus, String> {
    let vault_path: PathBuf = {
        let guard = vault_root
            .0
            .lock()
            .map_err(|_| "Failed to lock vault root".to_string())?;
        guard
            .clone()
            .ok_or_else(|| "No vault open".to_string())?
    };

    // Check if a fresh host presence exists — if so, join as client
    if let Some(info) = presence::has_fresh_host(&vault_path) {
        let host_address = format!("{}:{}", info.host, info.port);
        {
            let mut cfg = config_state
                .0
                .lock()
                .map_err(|_| "Failed to lock config".to_string())?;
            *cfg = CollabConfigInner {
                role: Some(CollabRole::Client),
                server_port: Some(info.port),
                host_address: Some(host_address.clone()),
            };
        }
        return Ok(CollabStatus {
            active: true,
            role: Some(CollabRole::Client),
            connected_clients: 0,
            server_port: Some(info.port),
            host_address: Some(host_address),
        });
    }

    // Start server
    let (relay, port) = RelayServer::start(password, app_handle.clone()).await?;

    // Get local IP
    let local_ip = local_ip_address::local_ip()
        .map(|ip| ip.to_string())
        .unwrap_or_else(|_| "127.0.0.1".to_string());

    // Write presence file
    presence::write_presence(&vault_path, &local_ip, port)?;

    let host_address = format!("{}:{}", local_ip, port);

    // Update config
    {
        let mut cfg = config_state
            .0
            .lock()
            .map_err(|_| "Failed to lock config".to_string())?;
        *cfg = CollabConfigInner {
            role: Some(CollabRole::Host),
            server_port: Some(port),
            host_address: Some(host_address.clone()),
        };
    }

    // Store server state
    {
        let mut state = server_state.0.lock().await;
        *state = Some(Arc::clone(&relay));
    }

    // Start heartbeat task (every 5s)
    let vault_path_clone = vault_path.clone();
    let handle = tokio::spawn(async move {
        let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(5));
        loop {
            interval.tick().await;
            if let Err(e) = presence::update_heartbeat(&vault_path_clone) {
                eprintln!("[collab] Heartbeat update failed: {}", e);
            }
        }
    });

    {
        let mut hb = heartbeat_state.0.lock().await;
        if let Some(old) = hb.take() {
            old.abort();
        }
        *hb = Some(handle);
    }

    Ok(CollabStatus {
        active: true,
        role: Some(CollabRole::Host),
        connected_clients: 0,
        server_port: Some(port),
        host_address: Some(host_address),
    })
}

#[tauri::command]
pub async fn stop_collab(
    server_state: tauri::State<'_, CollabServerState>,
    config_state: tauri::State<'_, CollabConfig>,
    heartbeat_state: tauri::State<'_, HeartbeatHandle>,
    vault_root: tauri::State<'_, crate::VaultRoot>,
) -> Result<(), String> {
    // Abort heartbeat
    {
        let mut hb = heartbeat_state.0.lock().await;
        if let Some(handle) = hb.take() {
            handle.abort();
        }
    }

    // Stop server
    {
        let mut state = server_state.0.lock().await;
        if let Some(relay) = state.take() {
            relay.stop();
        }
    }

    // Delete presence file
    {
        let guard = vault_root
            .0
            .lock()
            .map_err(|_| "Failed to lock vault root".to_string())?;
        if let Some(path) = guard.as_ref() {
            presence::delete_presence(path);
        }
    }

    // Reset config
    {
        let mut cfg = config_state
            .0
            .lock()
            .map_err(|_| "Failed to lock config".to_string())?;
        *cfg = CollabConfigInner::default();
    }

    Ok(())
}

#[tauri::command]
pub fn read_collab_presence(
    vault_root: tauri::State<'_, crate::VaultRoot>,
) -> Option<presence::PresenceInfo> {
    let guard = vault_root.0.lock().ok()?;
    let path = guard.as_ref()?;
    presence::has_fresh_host(path)
}

#[tauri::command]
pub async fn get_collab_status(
    server_state: tauri::State<'_, CollabServerState>,
    config_state: tauri::State<'_, CollabConfig>,
) -> Result<CollabStatus, String> {
    let cfg = {
        let guard = config_state
            .0
            .lock()
            .map_err(|_| "Failed to lock config".to_string())?;
        guard.clone()
    };

    let (active, connected_clients) = {
        let state = server_state.0.lock().await;
        match state.as_ref() {
            Some(relay) => (true, relay.client_count().await),
            None => (false, 0),
        }
    };

    Ok(CollabStatus {
        active,
        role: cfg.role,
        connected_clients,
        server_port: cfg.server_port,
        host_address: cfg.host_address,
    })
}
