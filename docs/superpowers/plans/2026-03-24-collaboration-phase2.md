# Real-Time Collaboration (Phase 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable real-time multi-user collaborative editing for shared-folder vaults, with live cursors, presence, host election via presence file, and a Settings UI toggle.

**Architecture:** Rust backend provides a dumb WebSocket relay server (tokio-tungstenite) with password auth (argon2). Host discovery uses a `.cascade/collab.json` presence file in the shared vault — no mDNS needed. The frontend runs all CRDT logic via Yjs with a custom WebSocket provider, binding to CodeMirror 6 via y-codemirror.next. The Awareness protocol (y-protocols) provides live cursors and presence.

**Tech Stack:** tokio-tungstenite, argon2, local-ip-address (Rust); yjs, y-codemirror.next, y-protocols (npm); Zustand store; Tauri IPC

**Spec:** `docs/superpowers/specs/2026-03-23-collaboration-design.md`

**Security note (v1):** Password sent over plaintext WebSocket on trusted LAN. No TLS in v1. Password never persisted to disk — prompted each session.

---

## File Structure

### Rust (src-tauri/src/)

| File | Responsibility |
|------|---------------|
| `collab/mod.rs` | Module root, re-exports, shared types (CollabRole, CollabStatus) |
| `collab/server.rs` | WebSocket relay — accept connections, verify password, broadcast messages |
| `collab/presence.rs` | Presence file — read/write/delete `.cascade/collab.json`, heartbeat |
| `collab/commands.rs` | Tauri commands — start/stop collab, read presence, get status |

### Frontend (src/)

| File | Responsibility |
|------|---------------|
| `src/lib/collab-init.ts` | Global singletons (provider, doc manager), startup/shutdown glue (created FIRST — other files import from it) |
| `src/lib/collab-provider.ts` | Custom Yjs WebSocket provider — sync protocol, awareness forwarding, reconnect |
| `src/lib/collab-doc-manager.ts` | Y.Doc lifecycle — create/dispose per file with ref counting |
| `src/lib/collab-messages.ts` | Message types, encode/decode helpers, path normalization |
| `src/lib/tauri-commands.ts` | Add collab IPC wrappers (modify existing) |
| `src/stores/collab-store.ts` | Zustand store — collab state, role, connected users, active docs |
| `src/editor/collab-extension.ts` | CodeMirror collab compartment — y-codemirror.next binding with awareness |
| `src/editor/codemirror-extensions.ts` | Add collabComp to Compartments interface (modify existing) |
| `src/editor/use-codemirror.ts` | Wire collab compartment into editor (modify existing) |
| `src/hooks/use-fs-watcher.ts` | Collab-aware watcher + presence file detection (modify existing) |
| `src/stores/editor-helpers.ts` | Collab-aware save — host writes Y.Doc content, non-host skips (modify existing) |
| `src/stores/editor-store.ts` | handleCollabRename/Delete actions (modify existing) |
| `src/stores/vault-store.ts` | Broadcast lifecycle events on rename/delete (modify existing) |
| `src/components/settings/pages/CollaborationSettingsPage.tsx` | Settings UI — enable, name, color, password prompt |
| `src/components/settings/shared/constants.ts` | Add 'collaboration' category (modify existing) |
| `src/components/settings/shared/searchable-items.ts` | Add collab search items (modify existing) |
| `src/stores/settings-store.ts` | Add collab settings (name, color — NOT password) (modify existing) |
| `src/locales/en/settings.json` | Add collab i18n strings (modify existing) |
| `src/components/StatusBar.tsx` | Collab indicator in status bar (modify existing) |

### Tests

| File | What it tests |
|------|--------------|
| `src/lib/collab-messages.test.ts` | Message encode/decode, path normalization |
| `src/lib/collab-provider.test.ts` | Provider state machine, reconnect logic |
| `src/lib/collab-doc-manager.test.ts` | Y.Doc lifecycle, ref counting, disposal |
| `src-tauri/src/collab/mod.rs` | Rust unit tests for auth, presence file |

---

## Task 1: Add Dependencies

**Files:**
- Modify: `src-tauri/Cargo.toml`
- Modify: `package.json`

- [ ] **Step 1: Add Rust crates to Cargo.toml**

Add to `[dependencies]`:

```toml
tokio = { version = "1", features = ["net", "sync", "macros", "time"] }
tokio-tungstenite = "0.24"
futures-util = "0.3"
argon2 = "0.5"
rand = "0.8"
local-ip-address = "0.6"
```

Note: Do NOT include the `rt` feature for tokio — Tauri v2 manages its own tokio runtime.

- [ ] **Step 2: Add npm packages**

```bash
npm install yjs y-codemirror.next y-protocols
```

- [ ] **Step 3: Verify both build**

```bash
cd src-tauri && cargo check && cd .. && npm run build
```

- [ ] **Step 4: Commit**

```bash
git add src-tauri/Cargo.toml package.json package-lock.json
git commit -m "feat(collab): add dependencies for real-time collaboration"
```

---

## Task 2: Collab Shared Types + Presence File (Rust)

**Files:**
- Create: `src-tauri/src/collab/mod.rs`
- Create: `src-tauri/src/collab/presence.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Create collab module with shared types**

Create `src-tauri/src/collab/mod.rs`:

```rust
pub mod commands;
pub mod presence;
pub mod server;

use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::Mutex as TokioMutex;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum CollabRole {
    Host,
    Client,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CollabStatus {
    pub active: bool,
    pub role: Option<CollabRole>,
    pub connected_clients: usize,
    pub server_port: Option<u16>,
    pub host_address: Option<String>,
}

impl Default for CollabStatus {
    fn default() -> Self {
        Self {
            active: false,
            role: None,
            connected_clients: 0,
            server_port: None,
            host_address: None,
        }
    }
}

/// Managed Tauri state for the collaboration server.
pub struct CollabServerState(pub TokioMutex<Option<Arc<server::RelayServer>>>);

/// Managed Tauri state for the collab config.
pub struct CollabConfig(pub std::sync::Mutex<CollabConfigInner>);

#[derive(Default, Clone)]
pub struct CollabConfigInner {
    pub role: Option<CollabRole>,
    pub server_port: Option<u16>,
    pub host_address: Option<String>,
}

/// Managed state for the heartbeat background task.
pub struct HeartbeatHandle(pub TokioMutex<Option<tokio::task::JoinHandle<()>>>);

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn collab_status_default_is_inactive() {
        let status = CollabStatus::default();
        assert!(!status.active);
        assert!(status.role.is_none());
    }

    #[test]
    fn collab_role_serializes_lowercase() {
        assert_eq!(serde_json::to_string(&CollabRole::Host).unwrap(), "\"host\"");
        assert_eq!(serde_json::to_string(&CollabRole::Client).unwrap(), "\"client\"");
    }
}
```

- [ ] **Step 2: Create the presence file module**

Create `src-tauri/src/collab/presence.rs`:

```rust
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

const COLLAB_FILE: &str = ".cascade/collab.json";
const HEARTBEAT_STALE_MS: u128 = 15_000; // 15 seconds

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PresenceInfo {
    pub host: String,
    pub port: u16,
    pub started_at: u128,
    pub heartbeat: u128,
}

fn now_ms() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis()
}

fn collab_path(vault_root: &Path) -> PathBuf {
    vault_root.join(COLLAB_FILE)
}

/// Read the presence file. Returns None if missing or unparseable.
pub fn read_presence(vault_root: &Path) -> Option<PresenceInfo> {
    let path = collab_path(vault_root);
    let data = std::fs::read_to_string(&path).ok()?;
    serde_json::from_str(&data).ok()
}

/// Check if a presence file exists with a fresh heartbeat.
pub fn has_fresh_host(vault_root: &Path) -> Option<PresenceInfo> {
    let info = read_presence(vault_root)?;
    let age = now_ms().saturating_sub(info.heartbeat);
    if age < HEARTBEAT_STALE_MS {
        Some(info)
    } else {
        None
    }
}

/// Write/update the presence file (host only).
pub fn write_presence(vault_root: &Path, host_ip: &str, port: u16) -> Result<(), String> {
    let path = collab_path(vault_root);

    // Read existing to preserve started_at, or create new
    let started_at = read_presence(vault_root)
        .filter(|p| p.host == host_ip && p.port == port)
        .map(|p| p.started_at)
        .unwrap_or_else(now_ms);

    let info = PresenceInfo {
        host: host_ip.to_string(),
        port,
        started_at,
        heartbeat: now_ms(),
    };

    let json = serde_json::to_string_pretty(&info)
        .map_err(|e| format!("serialize presence: {e}"))?;
    std::fs::write(&path, json)
        .map_err(|e| format!("write presence file: {e}"))?;
    Ok(())
}

/// Update only the heartbeat timestamp (host only).
pub fn update_heartbeat(vault_root: &Path) -> Result<(), String> {
    let path = collab_path(vault_root);
    let mut info = read_presence(vault_root)
        .ok_or_else(|| "no presence file to update".to_string())?;
    info.heartbeat = now_ms();
    let json = serde_json::to_string_pretty(&info)
        .map_err(|e| format!("serialize: {e}"))?;
    std::fs::write(&path, json)
        .map_err(|e| format!("write heartbeat: {e}"))?;
    Ok(())
}

/// Delete the presence file (host shutdown).
pub fn delete_presence(vault_root: &Path) {
    let path = collab_path(vault_root);
    let _ = std::fs::remove_file(&path);
}

/// Check if current presence file belongs to us (matching host+port).
pub fn is_our_presence(vault_root: &Path, our_ip: &str, our_port: u16) -> bool {
    match read_presence(vault_root) {
        Some(info) => info.host == our_ip && info.port == our_port,
        None => false,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    fn setup() -> TempDir {
        let dir = TempDir::new().unwrap();
        std::fs::create_dir_all(dir.path().join(".cascade")).unwrap();
        dir
    }

    #[test]
    fn write_and_read_presence() {
        let dir = setup();
        write_presence(dir.path(), "192.168.1.5", 9000).unwrap();
        let info = read_presence(dir.path()).unwrap();
        assert_eq!(info.host, "192.168.1.5");
        assert_eq!(info.port, 9000);
    }

    #[test]
    fn fresh_host_detected() {
        let dir = setup();
        write_presence(dir.path(), "10.0.0.1", 8080).unwrap();
        assert!(has_fresh_host(dir.path()).is_some());
    }

    #[test]
    fn stale_host_returns_none() {
        let dir = setup();
        // Write with a stale heartbeat
        let info = PresenceInfo {
            host: "10.0.0.1".into(),
            port: 8080,
            started_at: 1000,
            heartbeat: 1000, // epoch — definitely stale
        };
        let path = dir.path().join(".cascade/collab.json");
        std::fs::write(&path, serde_json::to_string(&info).unwrap()).unwrap();
        assert!(has_fresh_host(dir.path()).is_none());
    }

    #[test]
    fn delete_removes_file() {
        let dir = setup();
        write_presence(dir.path(), "10.0.0.1", 8080).unwrap();
        delete_presence(dir.path());
        assert!(read_presence(dir.path()).is_none());
    }

    #[test]
    fn is_our_presence_check() {
        let dir = setup();
        write_presence(dir.path(), "192.168.1.5", 9000).unwrap();
        assert!(is_our_presence(dir.path(), "192.168.1.5", 9000));
        assert!(!is_our_presence(dir.path(), "192.168.1.99", 9000));
    }
}
```

- [ ] **Step 3: Add `mod collab;` to lib.rs and register state**

In `src-tauri/src/lib.rs`, add after `mod watcher;`:
```rust
mod collab;
```

Add managed state to the builder:
```rust
.manage(collab::CollabServerState(tokio::sync::Mutex::new(None)))
.manage(collab::CollabConfig(std::sync::Mutex::new(collab::CollabConfigInner::default())))
.manage(collab::HeartbeatHandle(tokio::sync::Mutex::new(None)))
```

- [ ] **Step 4: Create stub sub-modules**

Create `src-tauri/src/collab/server.rs`:
```rust
// WebSocket relay server — implemented in Task 3
```

Create `src-tauri/src/collab/commands.rs`:
```rust
// Tauri commands — implemented in Task 5
```

- [ ] **Step 5: Run tests**

```bash
cd src-tauri && cargo test collab
```
Expected: 7 tests pass (2 mod + 5 presence).

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/collab/ src-tauri/src/lib.rs
git commit -m "feat(collab): add collab module with shared types and presence file management"
```

---

## Task 3: WebSocket Relay Server (Rust)

**Files:**
- Modify: `src-tauri/src/collab/server.rs`

- [ ] **Step 1: Implement the WebSocket relay server**

Write `src-tauri/src/collab/server.rs`:

```rust
use std::collections::HashMap;
use std::net::SocketAddr;
use std::sync::Arc;

use argon2::{Argon2, PasswordHash, PasswordHasher, PasswordVerifier};
use argon2::password_hash::SaltString;
use futures_util::{SinkExt, StreamExt};
use rand::rngs::OsRng;
use tokio::net::TcpListener;
use tokio::sync::{broadcast, RwLock};
use tokio_tungstenite::accept_async;
use tokio_tungstenite::tungstenite::Message;

#[derive(Clone)]
pub struct VaultAuth {
    pub password_hash: String,
}

impl VaultAuth {
    pub fn new(password: &str) -> Self {
        let salt = SaltString::generate(&mut OsRng);
        let argon2 = Argon2::default();
        let hash = argon2
            .hash_password(password.as_bytes(), &salt)
            .expect("hash password")
            .to_string();
        Self { password_hash: hash }
    }

    pub fn verify(&self, password: &str) -> bool {
        match PasswordHash::new(&self.password_hash) {
            Ok(parsed) => Argon2::default()
                .verify_password(password.as_bytes(), &parsed)
                .is_ok(),
            Err(_) => false,
        }
    }
}

struct ClientInfo {
    connected_at: std::time::Instant,
    addr: SocketAddr,
}

pub struct RelayServer {
    auth: VaultAuth,
    clients: Arc<RwLock<HashMap<SocketAddr, ClientInfo>>>,
    tx: broadcast::Sender<(SocketAddr, Message)>,
    shutdown: tokio::sync::watch::Sender<bool>,
}

impl RelayServer {
    pub async fn start(
        password: String,
        app_handle: tauri::AppHandle,
    ) -> Result<(Arc<Self>, u16), String> {
        let listener = TcpListener::bind("0.0.0.0:0")
            .await
            .map_err(|e| format!("bind failed: {e}"))?;
        let port = listener.local_addr().map_err(|e| format!("{e}"))?.port();

        let (tx, _) = broadcast::channel::<(SocketAddr, Message)>(1024);
        let (shutdown_tx, shutdown_rx) = tokio::sync::watch::channel(false);

        let server = Arc::new(Self {
            auth: VaultAuth::new(&password),
            clients: Arc::new(RwLock::new(HashMap::new())),
            tx,
            shutdown: shutdown_tx,
        });

        let server_clone = server.clone();
        let handle = app_handle.clone();
        tokio::spawn(async move {
            let mut shutdown_rx = shutdown_rx;
            loop {
                tokio::select! {
                    result = listener.accept() => {
                        if let Ok((stream, addr)) = result {
                            let s = server_clone.clone();
                            let h = handle.clone();
                            tokio::spawn(async move { s.handle_connection(stream, addr, h).await });
                        }
                    }
                    _ = shutdown_rx.changed() => break,
                }
            }
        });

        Ok((server, port))
    }

    async fn handle_connection(
        &self,
        stream: tokio::net::TcpStream,
        addr: SocketAddr,
        app_handle: tauri::AppHandle,
    ) {
        let ws_stream = match accept_async(stream).await {
            Ok(ws) => ws,
            Err(_) => return,
        };
        let (mut ws_tx, mut ws_rx) = ws_stream.split();

        // Auth: first message must be the password
        let authed = match ws_rx.next().await {
            Some(Ok(Message::Text(pw))) => self.auth.verify(&pw),
            _ => false,
        };
        if !authed {
            let _ = ws_tx.send(Message::Text("AUTH_FAILED".into())).await;
            return;
        }
        let _ = ws_tx.send(Message::Text("AUTH_OK".into())).await;

        // Register
        {
            let mut clients = self.clients.write().await;
            clients.insert(addr, ClientInfo { connected_at: std::time::Instant::now(), addr });
        }
        self.emit_status(&app_handle).await;

        let mut rx = self.tx.subscribe();

        // Relay loop
        loop {
            tokio::select! {
                msg = ws_rx.next() => {
                    match msg {
                        Some(Ok(msg)) if msg.is_binary() || msg.is_text() => {
                            let _ = self.tx.send((addr, msg));
                        }
                        Some(Ok(Message::Close(_))) | None => break,
                        _ => {}
                    }
                }
                result = rx.recv() => {
                    match result {
                        Ok((sender, msg)) if sender != addr => {
                            if ws_tx.send(msg).await.is_err() { break; }
                        }
                        Err(broadcast::error::RecvError::Lagged(n)) => {
                            eprintln!("collab: client {addr} lagged {n} msgs");
                        }
                        Err(broadcast::error::RecvError::Closed) => break,
                        _ => {}
                    }
                }
            }
        }

        // Unregister
        { self.clients.write().await.remove(&addr); }
        self.emit_status(&app_handle).await;
    }

    async fn emit_status(&self, app_handle: &tauri::AppHandle) {
        let count = self.clients.read().await.len();
        let _ = tauri::Emitter::emit(app_handle, "collab://status", serde_json::json!({
            "connectedClients": count,
        }));
    }

    pub async fn client_count(&self) -> usize {
        self.clients.read().await.len()
    }

    pub fn stop(&self) {
        let _ = self.shutdown.send(true);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn vault_auth_roundtrip() {
        let auth = VaultAuth::new("test-password");
        assert!(auth.verify("test-password"));
        assert!(!auth.verify("wrong"));
    }

    #[test]
    fn vault_auth_empty() {
        let auth = VaultAuth::new("");
        assert!(auth.verify(""));
        assert!(!auth.verify("x"));
    }
}
```

- [ ] **Step 2: Run tests**

```bash
cd src-tauri && cargo test collab
```
Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/collab/server.rs
git commit -m "feat(collab): implement WebSocket relay server with password auth"
```

---

## Task 4: Frontend Message Types

**Files:**
- Create: `src/lib/collab-messages.ts`
- Create: `src/lib/collab-messages.test.ts`

- [ ] **Step 1: Write tests**

Create `src/lib/collab-messages.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { encodeLifecycleEvent, decodeLifecycleEvent, isLifecycleMessage, normalizePath } from './collab-messages';
import type { LifecycleEvent } from './collab-messages';

describe('collab-messages', () => {
  it('roundtrips file-created', () => {
    const e: LifecycleEvent = { type: 'file-created', path: 'notes/hello.md', by: 'Matt' };
    expect(decodeLifecycleEvent(encodeLifecycleEvent(e))).toEqual(e);
  });

  it('roundtrips file-renamed', () => {
    const e: LifecycleEvent = { type: 'file-renamed', oldPath: 'a.md', newPath: 'b.md', by: 'Alice' };
    expect(decodeLifecycleEvent(encodeLifecycleEvent(e))).toEqual(e);
  });

  it('roundtrips file-deleted', () => {
    const e: LifecycleEvent = { type: 'file-deleted', path: 'old.md', by: 'Bob' };
    expect(decodeLifecycleEvent(encodeLifecycleEvent(e))).toEqual(e);
  });

  it('identifies lifecycle messages', () => {
    const e: LifecycleEvent = { type: 'file-created', path: 'x.md', by: 'Z' };
    expect(isLifecycleMessage(encodeLifecycleEvent(e))).toBe(true);
    expect(isLifecycleMessage('AUTH_OK')).toBe(false);
  });

  it('normalizes backslashes to forward slashes', () => {
    expect(normalizePath('notes\\hello.md')).toBe('notes/hello.md');
    expect(normalizePath('notes/hello.md')).toBe('notes/hello.md');
  });
});
```

- [ ] **Step 2: Implement**

Create `src/lib/collab-messages.ts`:

```typescript
const LIFECYCLE_PREFIX = 'LIFECYCLE:';

export type LifecycleEvent =
  | { type: 'file-created'; path: string; by: string }
  | { type: 'file-renamed'; oldPath: string; newPath: string; by: string }
  | { type: 'file-deleted'; path: string; by: string };

export function encodeLifecycleEvent(event: LifecycleEvent): string {
  return LIFECYCLE_PREFIX + JSON.stringify(event);
}

export function decodeLifecycleEvent(data: string): LifecycleEvent {
  return JSON.parse(data.slice(LIFECYCLE_PREFIX.length));
}

export function isLifecycleMessage(data: string): boolean {
  return data.startsWith(LIFECYCLE_PREFIX);
}

/** Normalize file paths to forward slashes for cross-platform Y.Doc key consistency. */
export function normalizePath(path: string): string {
  return path.replace(/\\/g, '/');
}
```

- [ ] **Step 3: Run tests**

```bash
npm test -- --run src/lib/collab-messages.test.ts
```
Expected: 5 tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/lib/collab-messages.ts src/lib/collab-messages.test.ts
git commit -m "feat(collab): add lifecycle event messages with path normalization"
```

---

## Task 5: Tauri Commands (Rust)

**Files:**
- Modify: `src-tauri/src/collab/commands.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Implement Tauri commands**

Write `src-tauri/src/collab/commands.rs`:

```rust
use std::sync::Arc;
use tauri::{AppHandle, Manager, State};

use super::presence::{self, PresenceInfo};
use super::server::RelayServer;
use super::{CollabConfig, CollabRole, CollabServerState, CollabStatus, HeartbeatHandle};
use crate::VaultRoot;

/// Start collaboration as host: start WebSocket server, write presence file, start heartbeat.
#[tauri::command]
pub async fn start_collab(
    app_handle: AppHandle,
    password: String,
    server_state: State<'_, CollabServerState>,
    config_state: State<'_, CollabConfig>,
    heartbeat_state: State<'_, HeartbeatHandle>,
    vault_root: State<'_, VaultRoot>,
) -> Result<CollabStatus, String> {
    // Check if already running
    {
        let guard = server_state.0.lock().await;
        if guard.is_some() {
            return Err("Collaboration already active".into());
        }
    }

    let vault_path = {
        let guard = vault_root.0.lock().unwrap();
        guard.clone().ok_or("No vault open")?
    };

    // Check for existing fresh host
    if let Some(info) = presence::has_fresh_host(&vault_path) {
        let addr = format!("{}:{}", info.host, info.port);
        let mut config = config_state.0.lock().unwrap();
        config.role = Some(CollabRole::Client);
        config.host_address = Some(addr.clone());
        return Ok(CollabStatus {
            active: true,
            role: Some(CollabRole::Client),
            connected_clients: 0,
            server_port: None,
            host_address: Some(addr),
        });
    }

    // Start WebSocket relay
    let (server, port) = RelayServer::start(password, app_handle.clone()).await?;
    {
        let mut guard = server_state.0.lock().await;
        *guard = Some(server);
    }

    // Get our LAN IP
    let local_ip = local_ip_address::local_ip()
        .map(|ip| ip.to_string())
        .unwrap_or_else(|_| "127.0.0.1".to_string());

    // Write presence file
    presence::write_presence(&vault_path, &local_ip, port)?;

    // Start heartbeat (every 5 seconds)
    let vp = vault_path.clone();
    let heartbeat = tokio::spawn(async move {
        let mut interval = tokio::time::interval(std::time::Duration::from_secs(5));
        loop {
            interval.tick().await;
            if presence::update_heartbeat(&vp).is_err() {
                break;
            }
        }
    });
    {
        let mut guard = heartbeat_state.0.lock().await;
        *guard = Some(heartbeat);
    }

    // Update config
    {
        let mut config = config_state.0.lock().unwrap();
        config.role = Some(CollabRole::Host);
        config.server_port = Some(port);
    }

    Ok(CollabStatus {
        active: true,
        role: Some(CollabRole::Host),
        connected_clients: 0,
        server_port: Some(port),
        host_address: None,
    })
}

/// Stop collaboration: shut down server, delete presence file, stop heartbeat.
#[tauri::command]
pub async fn stop_collab(
    server_state: State<'_, CollabServerState>,
    config_state: State<'_, CollabConfig>,
    heartbeat_state: State<'_, HeartbeatHandle>,
    vault_root: State<'_, VaultRoot>,
) -> Result<(), String> {
    // Stop heartbeat
    {
        let mut guard = heartbeat_state.0.lock().await;
        if let Some(handle) = guard.take() {
            handle.abort();
        }
    }
    // Stop server
    {
        let mut guard = server_state.0.lock().await;
        if let Some(server) = guard.take() {
            server.stop();
        }
    }
    // Delete presence file
    {
        let guard = vault_root.0.lock().unwrap();
        if let Some(vp) = guard.as_ref() {
            presence::delete_presence(vp);
        }
    }
    // Reset config
    {
        let mut config = config_state.0.lock().unwrap();
        *config = super::CollabConfigInner::default();
    }
    Ok(())
}

/// Read the presence file to check for an active host.
#[tauri::command]
pub async fn read_collab_presence(
    vault_root: State<'_, VaultRoot>,
) -> Result<Option<PresenceInfo>, String> {
    let guard = vault_root.0.lock().unwrap();
    let vp = guard.as_ref().ok_or("No vault open")?;
    Ok(presence::has_fresh_host(vp))
}

/// Get current collaboration status.
#[tauri::command]
pub async fn get_collab_status(
    server_state: State<'_, CollabServerState>,
    config_state: State<'_, CollabConfig>,
) -> Result<CollabStatus, String> {
    let config = config_state.0.lock().unwrap().clone();
    let client_count = {
        let guard = server_state.0.lock().await;
        match guard.as_ref() {
            Some(server) => server.client_count().await,
            None => 0,
        }
    };
    Ok(CollabStatus {
        active: config.role.is_some(),
        role: config.role,
        connected_clients: client_count,
        server_port: config.server_port,
        host_address: config.host_address,
    })
}
```

- [ ] **Step 2: Register commands in lib.rs**

Add to `generate_handler![]`:

```rust
collab::commands::start_collab,
collab::commands::stop_collab,
collab::commands::read_collab_presence,
collab::commands::get_collab_status,
```

- [ ] **Step 3: Verify it compiles**

```bash
cd src-tauri && cargo check
```

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/collab/commands.rs src-tauri/src/lib.rs
git commit -m "feat(collab): add Tauri commands with presence file and heartbeat"
```

---

## Task 6: Frontend IPC + Collab Store + Init Module

**Files:**
- Modify: `src/lib/tauri-commands.ts`
- Create: `src/stores/collab-store.ts`
- Create: `src/lib/collab-init.ts`

Note: `collab-init.ts` is created here (early) because later tasks import `getGlobalProvider`/`getGlobalDocManager` from it.

- [ ] **Step 1: Add IPC wrappers**

Add to `src/lib/tauri-commands.ts`:

```typescript
// --- Collaboration ---

export interface CollabStatus {
  active: boolean;
  role: 'host' | 'client' | null;
  connectedClients: number;
  serverPort: number | null;
  hostAddress: string | null;
}

export interface PresenceInfo {
  host: string;
  port: number;
  startedAt: number;
  heartbeat: number;
}

export function startCollab(password: string): Promise<CollabStatus> {
  return invoke<CollabStatus>('start_collab', { password });
}

export function stopCollab(): Promise<void> {
  return invoke<void>('stop_collab');
}

export function readCollabPresence(): Promise<PresenceInfo | null> {
  return invoke<PresenceInfo | null>('read_collab_presence');
}

export function getCollabStatus(): Promise<CollabStatus> {
  return invoke<CollabStatus>('get_collab_status');
}
```

- [ ] **Step 2: Create the collab store**

Create `src/stores/collab-store.ts`:

```typescript
import { create } from 'zustand';
import * as cmd from '../lib/tauri-commands';
import { normalizePath } from '../lib/collab-messages';

export interface CollabUser {
  name: string;
  color: string;
  activeFile: string | null;
}

interface CollabState {
  active: boolean;
  role: 'host' | 'client' | null;
  connectedClients: number;
  serverPort: number | null;
  hostAddress: string | null;
  userName: string;
  userColor: string;
  users: Map<number, CollabUser>;
  activeDocPaths: Set<string>;

  startAsHost: (password: string, name: string, color: string) => Promise<void>;
  setClientState: (address: string, name: string, color: string) => void;
  promoteToHost: (password: string) => Promise<void>;
  disconnect: () => Promise<void>;
  addActiveDoc: (path: string) => void;
  removeActiveDoc: (path: string) => void;
  updateUsers: (users: Map<number, CollabUser>) => void;
  updateConnectedClients: (count: number) => void;
}

export const useCollabStore = create<CollabState>((set, get) => ({
  active: false,
  role: null,
  connectedClients: 0,
  serverPort: null,
  hostAddress: null,
  userName: '',
  userColor: '',
  users: new Map(),
  activeDocPaths: new Set(),

  startAsHost: async (password, name, color) => {
    const status = await cmd.startCollab(password);
    set({
      active: status.active,
      role: status.role,
      connectedClients: status.connectedClients,
      serverPort: status.serverPort,
      hostAddress: status.hostAddress,
      userName: name,
      userColor: color,
    });
  },

  setClientState: (address, name, color) => {
    set({ active: true, role: 'client', hostAddress: address, userName: name, userColor: color });
  },

  promoteToHost: async (password) => {
    const status = await cmd.startCollab(password);
    set({
      role: 'host',
      serverPort: status.serverPort,
      hostAddress: null,
      connectedClients: 0,
    });
  },

  disconnect: async () => {
    await cmd.stopCollab().catch(() => {});
    set({
      active: false, role: null, connectedClients: 0,
      serverPort: null, hostAddress: null,
      users: new Map(), activeDocPaths: new Set(),
    });
  },

  addActiveDoc: (path) => {
    const docs = new Set(get().activeDocPaths);
    docs.add(normalizePath(path));
    set({ activeDocPaths: docs });
  },

  removeActiveDoc: (path) => {
    const docs = new Set(get().activeDocPaths);
    docs.delete(normalizePath(path));
    set({ activeDocPaths: docs });
  },

  updateUsers: (users) => set({ users }),
  updateConnectedClients: (count) => set({ connectedClients: count }),
}));
```

- [ ] **Step 3: Create the collab-init module (stubs for now, fleshed out in Task 14)**

Create `src/lib/collab-init.ts`:

```typescript
import { CollabProvider } from './collab-provider';
import { CollabDocManager } from './collab-doc-manager';

let provider: CollabProvider | null = null;
let docManager: CollabDocManager | null = null;

export function getGlobalProvider(): CollabProvider | null {
  return provider;
}

export function getGlobalDocManager(): CollabDocManager {
  if (!docManager) {
    docManager = new CollabDocManager();
  }
  return docManager;
}

export function setGlobalProvider(p: CollabProvider | null): void {
  provider = p;
}

// Full implementation in Task 14 — startCollabSession, stopCollabSession, initCollab
```

This stub exists so Tasks 7–13 can import from it without compile errors.

- [ ] **Step 4: Verify build**

```bash
npm run build
```

Note: build may fail because `collab-provider.ts` and `collab-doc-manager.ts` don't exist yet. If so, create empty placeholder files:
- `src/lib/collab-provider.ts`: `export class CollabProvider { constructor(_u: string, _p: string) {} }`
- `src/lib/collab-doc-manager.ts`: `export class CollabDocManager {}`

- [ ] **Step 5: Commit**

```bash
git add src/lib/tauri-commands.ts src/stores/collab-store.ts src/lib/collab-init.ts
git commit -m "feat(collab): add frontend IPC, collab store, and init module stubs"
```

---

## Task 7: Custom Yjs WebSocket Provider

**Files:**
- Create: `src/lib/collab-provider.ts`
- Create: `src/lib/collab-provider.test.ts`

- [ ] **Step 1: Write provider tests**

Create `src/lib/collab-provider.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CollabProvider, ProviderState } from './collab-provider';

class MockWebSocket {
  static OPEN = 1;
  readyState = 0;
  binaryType = 'arraybuffer';
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: unknown }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  sent: unknown[] = [];
  close = vi.fn(() => { this.readyState = 3; this.onclose?.(); });
  send(data: unknown) { this.sent.push(data); }
  simulateOpen() { this.readyState = 1; this.onopen?.(); }
  simulateMessage(data: unknown) { this.onmessage?.({ data }); }
}

vi.stubGlobal('WebSocket', vi.fn(() => new MockWebSocket()));

describe('CollabProvider', () => {
  let provider: CollabProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new CollabProvider('ws://localhost:9000', 'pw');
  });

  it('starts disconnected', () => {
    expect(provider.state).toBe(ProviderState.Disconnected);
  });

  it('sends password on open', () => {
    provider.connect();
    const ws = (provider as any).ws as MockWebSocket;
    ws.simulateOpen();
    expect(ws.sent[0]).toBe('pw');
    expect(provider.state).toBe(ProviderState.Authenticating);
  });

  it('connected on AUTH_OK', () => {
    provider.connect();
    const ws = (provider as any).ws as MockWebSocket;
    ws.simulateOpen();
    ws.simulateMessage('AUTH_OK');
    expect(provider.state).toBe(ProviderState.Connected);
  });

  it('auth_failed on AUTH_FAILED', () => {
    provider.connect();
    const ws = (provider as any).ws as MockWebSocket;
    ws.simulateOpen();
    ws.simulateMessage('AUTH_FAILED');
    expect(provider.state).toBe(ProviderState.AuthFailed);
  });

  it('fires onStateChange', () => {
    const cb = vi.fn();
    provider.onStateChange = cb;
    provider.connect();
    expect(cb).toHaveBeenCalledWith(ProviderState.Connecting);
  });

  it('cleans up on disconnect', () => {
    provider.connect();
    provider.disconnect();
    expect(provider.state).toBe(ProviderState.Disconnected);
  });
});
```

- [ ] **Step 2: Implement the provider**

Create `src/lib/collab-provider.ts`:

```typescript
import * as Y from 'yjs';
import { Awareness, encodeAwarenessUpdate, applyAwarenessUpdate, removeAwarenessStates } from 'y-protocols/awareness';
import { encodeLifecycleEvent, decodeLifecycleEvent, isLifecycleMessage, normalizePath, type LifecycleEvent } from './collab-messages';

export enum ProviderState {
  Disconnected = 'disconnected',
  Connecting = 'connecting',
  Authenticating = 'authenticating',
  Connected = 'connected',
  AuthFailed = 'auth_failed',
}

const MSG_SYNC = 0;
const MSG_AWARENESS = 1;
const SYNC_STEP1 = 0;
const SYNC_STEP2 = 1;
const SYNC_UPDATE = 2;

function encodeTaggedMessage(filePath: string, payload: Uint8Array): ArrayBuffer {
  const encoder = new TextEncoder();
  const pathBytes = encoder.encode(filePath);
  const buf = new ArrayBuffer(2 + pathBytes.length + payload.length);
  new DataView(buf).setUint16(0, pathBytes.length);
  const arr = new Uint8Array(buf);
  arr.set(pathBytes, 2);
  arr.set(payload, 2 + pathBytes.length);
  return buf;
}

function decodeTaggedMessage(data: ArrayBuffer): { filePath: string; payload: Uint8Array } {
  const view = new DataView(data);
  const pathLength = view.getUint16(0);
  const pathBytes = new Uint8Array(data, 2, pathLength);
  const filePath = new TextDecoder().decode(pathBytes);
  const payload = new Uint8Array(data, 2 + pathLength);
  return { filePath, payload };
}

interface DocEntry {
  doc: Y.Doc;
  updateHandler: (update: Uint8Array, origin: unknown) => void;
}

export class CollabProvider {
  state: ProviderState = ProviderState.Disconnected;
  onStateChange?: (state: ProviderState) => void;
  onLifecycleEvent?: (event: LifecycleEvent) => void;
  awareness: Awareness;

  private url: string;
  private password: string;
  private ws: WebSocket | null = null;
  private docs = new Map<string, DocEntry>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectDelay = 1000;
  private shouldReconnect = false;
  private awarenessHandler: (...args: any[]) => void;

  constructor(url: string, password: string) {
    this.url = url;
    this.password = password;

    const awarenessDoc = new Y.Doc();
    this.awareness = new Awareness(awarenessDoc);

    this.awarenessHandler = (changes: { added: number[]; updated: number[]; removed: number[] }, origin: string) => {
      if (origin === 'local') {
        const update = encodeAwarenessUpdate(this.awareness, [
          ...changes.added, ...changes.updated, ...changes.removed,
        ]);
        this.sendRawBinary(MSG_AWARENESS, update);
      }
    };
    this.awareness.on('update', this.awarenessHandler);
  }

  connect(): void {
    if (this.state !== ProviderState.Disconnected && this.state !== ProviderState.AuthFailed) return;
    this.shouldReconnect = true;
    this.setState(ProviderState.Connecting);

    this.ws = new WebSocket(this.url);
    this.ws.binaryType = 'arraybuffer';

    this.ws.onopen = () => {
      this.ws!.send(this.password);
      this.setState(ProviderState.Authenticating);
    };

    this.ws.onmessage = (e) => {
      if (this.state === ProviderState.Authenticating) {
        if (e.data === 'AUTH_OK') {
          this.setState(ProviderState.Connected);
          this.reconnectDelay = 1000;
          for (const [path, entry] of this.docs) this.sendSyncStep1(path, entry.doc);
          this.sendRawBinary(MSG_AWARENESS, encodeAwarenessUpdate(this.awareness, [this.awareness.clientID]));
        } else if (e.data === 'AUTH_FAILED') {
          this.setState(ProviderState.AuthFailed);
          this.shouldReconnect = false;
          this.ws?.close();
        }
        return;
      }

      if (typeof e.data === 'string') {
        if (isLifecycleMessage(e.data)) this.onLifecycleEvent?.(decodeLifecycleEvent(e.data));
        return;
      }

      if (e.data instanceof ArrayBuffer) {
        const raw = new Uint8Array(e.data);
        if (raw.length < 2) return;
        const msgType = raw[0];

        if (msgType === MSG_AWARENESS) {
          applyAwarenessUpdate(this.awareness, raw.slice(1), 'remote');
          return;
        }

        if (msgType === MSG_SYNC) {
          const tagged = e.data.slice(1);
          const { filePath, payload } = decodeTaggedMessage(tagged);
          const entry = this.docs.get(filePath);
          if (entry) this.handleSyncMessage(filePath, entry.doc, payload);
        }
      }
    };

    this.ws.onclose = () => {
      this.setState(ProviderState.Disconnected);
      if (this.shouldReconnect) this.scheduleReconnect();
    };

    this.ws.onerror = () => {};
  }

  disconnect(): void {
    this.shouldReconnect = false;
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
    removeAwarenessStates(this.awareness, [this.awareness.clientID], 'local');
    this.ws?.close();
    this.ws = null;
    this.setState(ProviderState.Disconnected);
  }

  setLocalState(fields: Record<string, unknown>): void {
    this.awareness.setLocalStateField('user', fields);
  }

  registerDoc(filePath: string, doc: Y.Doc): void {
    const key = normalizePath(filePath);
    const updateHandler = (update: Uint8Array, origin: unknown) => {
      if (origin === this) return;
      this.sendTaggedSync(key, SYNC_UPDATE, update);
    };
    doc.on('update', updateHandler);
    this.docs.set(key, { doc, updateHandler });
    if (this.state === ProviderState.Connected) this.sendSyncStep1(key, doc);
  }

  unregisterDoc(filePath: string): void {
    const key = normalizePath(filePath);
    const entry = this.docs.get(key);
    if (entry) { entry.doc.off('update', entry.updateHandler); this.docs.delete(key); }
  }

  getDoc(filePath: string): Y.Doc | undefined {
    return this.docs.get(normalizePath(filePath))?.doc;
  }

  rekeyDoc(oldPath: string, newPath: string): void {
    const entry = this.docs.get(normalizePath(oldPath));
    if (entry) { this.docs.delete(normalizePath(oldPath)); this.docs.set(normalizePath(newPath), entry); }
  }

  sendLifecycleEvent(event: LifecycleEvent): void {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(encodeLifecycleEvent(event));
  }

  private sendSyncStep1(filePath: string, doc: Y.Doc): void {
    this.sendTaggedSync(filePath, SYNC_STEP1, Y.encodeStateVector(doc));
  }

  /**
   * Handle incoming sync. SYNC_STEP1 is answered with SYNC_STEP2 only —
   * never send SYNC_STEP1 back (would cause infinite loop).
   */
  private handleSyncMessage(filePath: string, doc: Y.Doc, payload: Uint8Array): void {
    if (payload.length < 1) return;
    const syncType = payload[0];
    const data = payload.slice(1);
    if (syncType === SYNC_STEP1) {
      this.sendTaggedSync(filePath, SYNC_STEP2, Y.encodeStateAsUpdate(doc, data));
    } else if (syncType === SYNC_STEP2 || syncType === SYNC_UPDATE) {
      Y.applyUpdate(doc, data, this);
    }
  }

  private sendTaggedSync(filePath: string, syncType: number, data: Uint8Array): void {
    if (this.ws?.readyState !== WebSocket.OPEN) return;
    const payload = new Uint8Array(1 + data.length);
    payload[0] = syncType;
    payload.set(data, 1);
    const tagged = encodeTaggedMessage(filePath, payload);
    const full = new Uint8Array(1 + tagged.byteLength);
    full[0] = MSG_SYNC;
    full.set(new Uint8Array(tagged), 1);
    this.ws.send(full.buffer);
  }

  private sendRawBinary(msgType: number, data: Uint8Array): void {
    if (this.ws?.readyState !== WebSocket.OPEN) return;
    const buf = new Uint8Array(1 + data.length);
    buf[0] = msgType;
    buf.set(data, 1);
    this.ws.send(buf.buffer);
  }

  private scheduleReconnect(): void {
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.state = ProviderState.Disconnected;
      this.connect();
    }, this.reconnectDelay);
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000);
  }

  private setState(state: ProviderState): void {
    this.state = state;
    this.onStateChange?.(state);
  }

  destroy(): void {
    this.disconnect();
    this.awareness.off('update', this.awarenessHandler);
    this.awareness.destroy();
  }
}
```

- [ ] **Step 3: Run tests**

```bash
npm test -- --run src/lib/collab-provider.test.ts
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/collab-provider.ts src/lib/collab-provider.test.ts
git commit -m "feat(collab): implement Yjs WebSocket provider with awareness protocol"
```

---

## Task 8: Y.Doc Manager

**Files:**
- Create: `src/lib/collab-doc-manager.ts`
- Create: `src/lib/collab-doc-manager.test.ts`

- [ ] **Step 1: Write tests**

Create `src/lib/collab-doc-manager.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { CollabDocManager } from './collab-doc-manager';
import * as Y from 'yjs';

describe('CollabDocManager', () => {
  let mgr: CollabDocManager;
  beforeEach(() => { mgr = new CollabDocManager(); });

  it('creates a Y.Doc with content', () => {
    const doc = mgr.getOrCreate('test.md', 'hello');
    expect(doc).toBeInstanceOf(Y.Doc);
    expect(doc.getText('content').toString()).toBe('hello');
  });

  it('returns same doc for same path', () => {
    expect(mgr.getOrCreate('a.md', 'x')).toBe(mgr.getOrCreate('a.md', 'x'));
  });

  it('disposes a doc', () => {
    mgr.getOrCreate('a.md', 'x');
    mgr.dispose('a.md');
    expect(mgr.get('a.md')).toBeUndefined();
  });

  it('disposes all', () => {
    mgr.getOrCreate('a.md', 'a');
    mgr.getOrCreate('b.md', 'b');
    mgr.disposeAll();
    expect(mgr.get('a.md')).toBeUndefined();
  });

  it('rekeys on rename', () => {
    const doc = mgr.getOrCreate('old.md', 'c');
    mgr.rekey('old.md', 'new.md');
    expect(mgr.get('old.md')).toBeUndefined();
    expect(mgr.get('new.md')).toBe(doc);
  });

  it('ref counting disposes at zero', () => {
    mgr.getOrCreate('t.md', 'h');
    mgr.addRef('t.md');
    mgr.removeRef('t.md');
    expect(mgr.get('t.md')).toBeDefined();
    mgr.removeRef('t.md');
    expect(mgr.get('t.md')).toBeUndefined();
  });

  it('normalizes paths', () => {
    const doc = mgr.getOrCreate('notes\\hello.md', 'hi');
    expect(mgr.get('notes/hello.md')).toBe(doc);
  });

  it('getContent returns Y.Text string', () => {
    mgr.getOrCreate('a.md', 'hello world');
    expect(mgr.getContent('a.md')).toBe('hello world');
  });
});
```

- [ ] **Step 2: Implement**

Create `src/lib/collab-doc-manager.ts`:

```typescript
import * as Y from 'yjs';
import { normalizePath } from './collab-messages';

interface DocEntry { doc: Y.Doc; refCount: number; }

export class CollabDocManager {
  private docs = new Map<string, DocEntry>();

  getOrCreate(filePath: string, initialContent: string): Y.Doc {
    const key = normalizePath(filePath);
    const existing = this.docs.get(key);
    if (existing) return existing.doc;

    const doc = new Y.Doc();
    doc.gc = true;
    const text = doc.getText('content');
    if (initialContent) doc.transact(() => { text.insert(0, initialContent); });
    this.docs.set(key, { doc, refCount: 1 });
    return doc;
  }

  get(filePath: string): Y.Doc | undefined {
    return this.docs.get(normalizePath(filePath))?.doc;
  }

  getContent(filePath: string): string | undefined {
    return this.get(filePath)?.getText('content').toString();
  }

  addRef(filePath: string): void {
    const e = this.docs.get(normalizePath(filePath));
    if (e) e.refCount++;
  }

  removeRef(filePath: string): void {
    const key = normalizePath(filePath);
    const e = this.docs.get(key);
    if (!e) return;
    if (--e.refCount <= 0) { e.doc.destroy(); this.docs.delete(key); }
  }

  dispose(filePath: string): void {
    const key = normalizePath(filePath);
    const e = this.docs.get(key);
    if (e) { e.doc.destroy(); this.docs.delete(key); }
  }

  disposeAll(): void {
    for (const [, e] of this.docs) e.doc.destroy();
    this.docs.clear();
  }

  rekey(oldPath: string, newPath: string): void {
    const oldKey = normalizePath(oldPath);
    const newKey = normalizePath(newPath);
    const e = this.docs.get(oldKey);
    if (e) { this.docs.delete(oldKey); this.docs.set(newKey, e); }
  }

  activePaths(): Set<string> { return new Set(this.docs.keys()); }
}
```

- [ ] **Step 3: Run tests**

```bash
npm test -- --run src/lib/collab-doc-manager.test.ts
```
Expected: 8 tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/lib/collab-doc-manager.ts src/lib/collab-doc-manager.test.ts
git commit -m "feat(collab): implement Y.Doc lifecycle manager"
```

---

## Task 9: CodeMirror Collab Extension

**Files:**
- Create: `src/editor/collab-extension.ts`
- Modify: `src/editor/codemirror-extensions.ts` (add `collabComp` to `Compartments`)
- Modify: `src/editor/use-codemirror.ts` (wire collab)

- [ ] **Step 1: Create the collab extension**

Create `src/editor/collab-extension.ts`:

```typescript
import { type Extension } from '@codemirror/state';
import { yCollab } from 'y-codemirror.next';
import type * as Y from 'yjs';
import type { Awareness } from 'y-protocols/awareness';

export function buildCollabExtension(ytext: Y.Text, awareness: Awareness): Extension {
  return yCollab(ytext, awareness);
}
```

- [ ] **Step 2: Add collabComp to codemirror-extensions.ts**

In `src/editor/codemirror-extensions.ts`:
1. Add `collabComp: Compartment` to the `Compartments` interface
2. Add `collabComp: new Compartment()` to `createCompartments()`
3. Add `comps.collabComp.of([])` to the extensions array

- [ ] **Step 3: Wire collab into use-codemirror.ts**

Add a `useEffect` that subscribes to collab active state. When a file is opened while collab is active:

```typescript
import { useCollabStore } from '../stores/collab-store';
import { getGlobalProvider, getGlobalDocManager } from '../lib/collab-init';
import { buildCollabExtension } from './collab-extension';

// Get active file path from editor store:
// const activeFilePath = useEditorStore((s) => s.tabs[s.activeTabIndex]?.path);

useEffect(() => {
  const view = viewRef.current;
  const comps = compsRef.current;
  if (!view || !comps || !activeFilePath) return;

  const collabActive = useCollabStore.getState().active;
  if (!collabActive) {
    view.dispatch({ effects: comps.collabComp.reconfigure([]) });
    return;
  }

  const provider = getGlobalProvider();
  const docMgr = getGlobalDocManager();
  if (!provider) return;

  const content = view.state.doc.toString();
  const ydoc = docMgr.getOrCreate(activeFilePath, content);
  const ytext = ydoc.getText('content');
  provider.registerDoc(activeFilePath, ydoc);
  useCollabStore.getState().addActiveDoc(activeFilePath);

  view.dispatch({
    effects: comps.collabComp.reconfigure(buildCollabExtension(ytext, provider.awareness)),
  });

  return () => {
    provider.unregisterDoc(activeFilePath);
    useCollabStore.getState().removeActiveDoc(activeFilePath);
    if (viewRef.current && compsRef.current) {
      viewRef.current.dispatch({ effects: compsRef.current.collabComp.reconfigure([]) });
    }
  };
}, [activeFilePath]);
```

Note: `activeFilePath` needs to be obtained from the editor store or passed as a prop. Check the existing hook to find how the current file path is accessed — it may be via `useEditorStore` subscription or a parameter to the hook.

- [ ] **Step 4: Verify build**

```bash
npm run build
```

- [ ] **Step 5: Commit**

```bash
git add src/editor/collab-extension.ts src/editor/codemirror-extensions.ts src/editor/use-codemirror.ts
git commit -m "feat(collab): add CodeMirror collab extension with y-codemirror.next"
```

---

## Task 10: File Watcher Collab-Aware Mode + Host Save + Presence Detection

**Files:**
- Modify: `src/hooks/use-fs-watcher.ts`
- Modify: `src/stores/editor-helpers.ts`
- Modify: `src/stores/editor-store.ts`

- [ ] **Step 1: Make file watcher collab-aware**

In `src/hooks/use-fs-watcher.ts`, in the `vault://fs-change` handler, after computing `relPath`:

```typescript
import { useCollabStore } from '../stores/collab-store';
import { normalizePath } from '../lib/collab-messages';

// Skip watcher events for collab-active files on non-host clients
const collabState = useCollabStore.getState();
if (collabState.active && collabState.role === 'client') {
  if (collabState.activeDocPaths.has(normalizePath(relPath))) return;
}

// Detect collab.json changes for auto-discovery / split-brain
if (relPath === '.cascade/collab.json' || relPath === '.cascade\\collab.json') {
  // Emit a custom event that collab-init listens to
  window.dispatchEvent(new CustomEvent('cascade:collab-presence-changed'));
  return; // Don't process as a normal file change
}
```

- [ ] **Step 2: Make save logic collab-aware**

In `src/stores/editor-helpers.ts`, at the start of `performSave`:

```typescript
import { useCollabStore } from './collab-store';
import { getGlobalDocManager } from '../lib/collab-init';
import { normalizePath } from '../lib/collab-messages';

const collabState = useCollabStore.getState();
const normalized = normalizePath(tab.path);

if (collabState.active && collabState.activeDocPaths.has(normalized)) {
  if (collabState.role === 'client') {
    // Non-host: don't write to disk
    clearDraft(tab.path);
    return { ...tab, savedContent: tab.content, isDirty: false };
  }
  if (collabState.role === 'host') {
    // Host: write Y.Doc content (source of truth)
    const ydocContent = getGlobalDocManager().getContent(tab.path);
    if (ydocContent !== undefined) {
      try {
        await cmd.writeFile(vaultRoot, tab.path, ydocContent);
      } catch {
        useToastStore.getState().addToast(`Failed to save "${tab.path}"`, 'error');
        return null;
      }
      clearDraft(tab.path);
      return { ...tab, content: ydocContent, savedContent: ydocContent, isDirty: false };
    }
  }
}
```

- [ ] **Step 3: Skip external change handling for collab-active files**

In `src/stores/editor-store.ts`, in `handleExternalChange`, add early return:

```typescript
const collabState = useCollabStore.getState();
if (collabState.active && collabState.activeDocPaths.has(normalizePath(relPath))) return;
```

- [ ] **Step 4: Add handleCollabRename and handleCollabDelete**

Add to `src/stores/editor-store.ts`:

```typescript
handleCollabRename: (oldPath: string, newPath: string) => {
  const { tabs, activeTabIndex } = get();
  const newTabs = tabs.map((t) => t.path === oldPath ? { ...t, path: newPath } : t);
  set({ tabs: newTabs, ...derived(newTabs, activeTabIndex) });
},

handleCollabDelete: (path: string) => {
  const { tabs, activeTabIndex } = get();
  const idx = tabs.findIndex((t) => t.path === path);
  if (idx === -1) return;
  const newTabs = tabs.map((t, i) => i === idx ? { ...t, isDirty: true } : t);
  set({ tabs: newTabs, ...derived(newTabs, activeTabIndex) });
},
```

- [ ] **Step 5: Commit**

```bash
git add src/hooks/use-fs-watcher.ts src/stores/editor-helpers.ts src/stores/editor-store.ts
git commit -m "feat(collab): collab-aware file watcher, save logic, and presence detection"
```

---

## Task 11: File Lifecycle Events

**Files:**
- Modify: `src/stores/vault-store.ts`

- [ ] **Step 1: Broadcast lifecycle events on rename/delete**

In `src/stores/vault-store.ts`, after the successful `cmd.renameFile` call in `renameFile`:

```typescript
import { useCollabStore } from './collab-store';
import { getGlobalProvider, getGlobalDocManager } from '../lib/collab-init';
import { normalizePath } from '../lib/collab-messages';

const collab = useCollabStore.getState();
if (collab.active) {
  const provider = getGlobalProvider();
  if (provider) {
    provider.sendLifecycleEvent({
      type: 'file-renamed', oldPath: normalizePath(oldPath), newPath: normalizePath(newPath), by: collab.userName,
    });
    provider.rekeyDoc(oldPath, newPath);
  }
  getGlobalDocManager().rekey(oldPath, newPath);
}
```

After the successful `cmd.deleteFile` call in `deleteFile`:

```typescript
const collab = useCollabStore.getState();
if (collab.active) {
  const provider = getGlobalProvider();
  if (provider) {
    provider.sendLifecycleEvent({
      type: 'file-deleted', path: normalizePath(path), by: collab.userName,
    });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/stores/vault-store.ts
git commit -m "feat(collab): broadcast file lifecycle events on rename/delete"
```

---

## Task 12: Settings UI + i18n

**Files:**
- Create: `src/components/settings/pages/CollaborationSettingsPage.tsx`
- Modify: `src/components/settings/shared/constants.ts`
- Modify: `src/components/settings/shared/searchable-items.ts`
- Modify: `src/stores/settings-store.ts`
- Modify: `src/locales/en/settings.json`

- [ ] **Step 1: Add settings fields (name + color only — NOT password)**

In `src/stores/settings-store.ts` interface and DEFAULTS:

```typescript
enableCollaboration: boolean;  // DEFAULTS: false
collabName: string;            // DEFAULTS: ''
collabColor: string;           // DEFAULTS: ''
```

- [ ] **Step 2: Add i18n strings to settings.json**

Add `"collaboration": "Collaboration"` to categories. Add collaboration section with label, enable, name, color, password, status, connect, disconnect strings.

- [ ] **Step 3: Add category + searchable items**

Add `'collaboration'` to `SettingsCategory` type. Add `{ id: 'collaboration', labelKey: 'categories.collaboration', icon: Users }` to `CATEGORIES`. Add searchable items for `collabEnabled`, `collabName`, `collabColor`.

- [ ] **Step 4: Create CollaborationSettingsPage**

Create `src/components/settings/pages/CollaborationSettingsPage.tsx` with:
- Enable toggle
- Name input
- Color picker (12 Catppuccin colors)
- Password input (React state only — never saved to disk)
- Start Hosting button / Disconnect button
- Status display when active

The password is held in component state and passed to `startCollabSession(password)`.

- [ ] **Step 5: Register the page in the Settings router**

- [ ] **Step 6: Commit**

```bash
git add src/components/settings/pages/CollaborationSettingsPage.tsx \
  src/components/settings/shared/constants.ts src/components/settings/shared/searchable-items.ts \
  src/stores/settings-store.ts src/locales/en/settings.json
git commit -m "feat(collab): add Collaboration settings page"
```

---

## Task 13: Status Bar Indicator

**Files:**
- Modify: `src/components/StatusBar.tsx`

- [ ] **Step 1: Add collab indicator**

```tsx
import { useCollabStore } from '../stores/collab-store';
import { Users } from 'lucide-react';

const collabActive = useCollabStore((s) => s.active);
const collabRole = useCollabStore((s) => s.role);
const connectedClients = useCollabStore((s) => s.connectedClients);

{collabActive && (
  <div className="flex items-center gap-1 text-[var(--ctp-green)]" title={
    collabRole === 'host' ? `Hosting — ${connectedClients} connected` : 'Connected'
  }>
    <Users size={12} />
    <span className="text-[10px]">{collabRole === 'host' ? connectedClients + 1 : ''}</span>
  </div>
)}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/StatusBar.tsx
git commit -m "feat(collab): add collaboration indicator to status bar"
```

---

## Task 14: Full Initialization Glue

**Files:**
- Modify: `src/lib/collab-init.ts` (replace stubs with full implementation)

- [ ] **Step 1: Implement the full collab-init module**

Replace the stub `src/lib/collab-init.ts` with:

```typescript
import { CollabProvider, ProviderState } from './collab-provider';
import { CollabDocManager } from './collab-doc-manager';
import { useCollabStore } from '../stores/collab-store';
import { useSettingsStore } from '../stores/settings-store';
import { useEditorStore } from '../stores/editor-store';
import { useToastStore } from '../stores/toast-store';
import * as cmd from './tauri-commands';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

let provider: CollabProvider | null = null;
let docManager: CollabDocManager | null = null;
let currentPassword = '';
let unlistenStatus: UnlistenFn | null = null;

export function getGlobalProvider(): CollabProvider | null { return provider; }

export function getGlobalDocManager(): CollabDocManager {
  if (!docManager) docManager = new CollabDocManager();
  return docManager;
}

export function setGlobalProvider(p: CollabProvider | null): void { provider = p; }

/** Call once at app startup to listen for backend events. */
export async function initCollab(): Promise<void> {
  unlistenStatus = await listen('collab://status', (event: any) => {
    if (typeof event.payload?.connectedClients === 'number') {
      useCollabStore.getState().updateConnectedClients(event.payload.connectedClients);
    }
  });

  // Listen for presence file changes (emitted by file watcher)
  window.addEventListener('cascade:collab-presence-changed', handlePresenceChange);
}

/** Start collaboration. Checks presence file to decide host vs client. */
export async function startCollabSession(password: string): Promise<void> {
  const settings = useSettingsStore.getState();
  if (!settings.collabName) {
    useToastStore.getState().addToast('Set your display name first', 'error');
    return;
  }

  currentPassword = password;
  const collab = useCollabStore.getState();

  try {
    // Rust command checks presence file: returns host or client role
    await collab.startAsHost(password, settings.collabName, settings.collabColor);
    const state = useCollabStore.getState();

    if (state.role === 'client' && state.hostAddress) {
      // Presence file had a fresh host — connect as client
      createProvider(`ws://${state.hostAddress}`, password, settings.collabName, settings.collabColor);
    } else if (state.role === 'host' && state.serverPort) {
      // We're host — connect to ourselves
      createProvider(`ws://localhost:${state.serverPort}`, password, settings.collabName, settings.collabColor);
    }
  } catch (e: unknown) {
    useToastStore.getState().addToast(`Collaboration failed: ${e}`, 'error');
  }
}

export async function stopCollabSession(): Promise<void> {
  provider?.destroy();
  provider = null;
  docManager?.disposeAll();
  currentPassword = '';
  await useCollabStore.getState().disconnect();
}

function createProvider(url: string, password: string, name: string, color: string): void {
  provider?.destroy();
  provider = new CollabProvider(url, password);
  provider.setLocalState({ name, color });

  provider.onStateChange = (state) => {
    if (state === ProviderState.AuthFailed) {
      useToastStore.getState().addToast('Wrong vault password', 'error');
    }
    if (state === ProviderState.Disconnected) {
      handleProviderDisconnect();
    }
  };

  provider.onLifecycleEvent = (event) => {
    const store = useEditorStore.getState() as any;
    if (event.type === 'file-renamed') {
      getGlobalDocManager().rekey(event.oldPath, event.newPath);
      store.handleCollabRename?.(event.oldPath, event.newPath);
    } else if (event.type === 'file-deleted') {
      useToastStore.getState().addToast(`"${event.path}" deleted by ${event.by}`, 'info');
      store.handleCollabDelete?.(event.path);
    }
  };

  provider.connect();
}

function handleProviderDisconnect(): void {
  const collab = useCollabStore.getState();
  if (collab.role !== 'client' || !collab.active) return;

  useToastStore.getState().addToast('Host disconnected. Will auto-promote if no new host appears...', 'info');

  // Wait 5s — if provider reconnects via backoff, great. Otherwise promote.
  setTimeout(async () => {
    if (!useCollabStore.getState().active) return;
    if (provider?.state === ProviderState.Connected) return;

    // Check if a new host appeared via presence file
    const presence = await cmd.readCollabPresence();
    if (presence) {
      // New host — reconnect to them
      provider?.destroy();
      const collab = useCollabStore.getState();
      collab.setClientState(`${presence.host}:${presence.port}`, collab.userName, collab.userColor);
      createProvider(`ws://${presence.host}:${presence.port}`, currentPassword, collab.userName, collab.userColor);
    } else {
      // No host — promote ourselves
      provider?.destroy();
      const collab = useCollabStore.getState();
      await collab.promoteToHost(currentPassword);
      const status = useCollabStore.getState();
      if (status.serverPort) {
        createProvider(`ws://localhost:${status.serverPort}`, currentPassword, collab.userName, collab.userColor);
      }
    }
  }, 5000);
}

/** Handle presence file changes detected by file watcher (split-brain + auto-discovery). */
async function handlePresenceChange(): Promise<void> {
  const collab = useCollabStore.getState();
  if (!collab.active) return;

  if (collab.role === 'host') {
    // Split-brain check: did someone else overwrite our presence file?
    const presence = await cmd.readCollabPresence();
    if (presence && presence.host !== 'localhost') {
      // Check if it's us by comparing our serverPort
      if (collab.serverPort && presence.port !== collab.serverPort) {
        // Someone else took over — demote to client
        useToastStore.getState().addToast('Another host detected. Connecting as client...', 'info');
        await cmd.stopCollab();
        collab.setClientState(`${presence.host}:${presence.port}`, collab.userName, collab.userColor);
        createProvider(`ws://${presence.host}:${presence.port}`, currentPassword, collab.userName, collab.userColor);
      }
    }
  }
}

export async function cleanupCollab(): Promise<void> {
  await stopCollabSession();
  unlistenStatus?.();
  window.removeEventListener('cascade:collab-presence-changed', handlePresenceChange);
}
```

- [ ] **Step 2: Wire initCollab at app startup**

In the app root / vault open flow:

```typescript
import { initCollab } from './lib/collab-init';

useEffect(() => { initCollab().catch(console.error); }, []);
```

- [ ] **Step 3: Verify build**

```bash
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/collab-init.ts
git commit -m "feat(collab): implement full initialization glue with host promotion and split-brain handling"
```

---

## Task 15: Integration Testing

- [ ] **Step 1: Run all tests**

```bash
npm test && cd src-tauri && cargo test
```

- [ ] **Step 2: Run full build**

```bash
npm run build && cd src-tauri && cargo build
```

- [ ] **Step 3: Manual testing checklist**

1. Settings → Collaboration → set name, pick color
2. Enter password, click "Start Hosting" → status shows "Hosting"
3. Instance B opens same vault → enables collab → auto-detects host from `.cascade/collab.json` → connects as client
4. Both open same .md file → type on A → appears on B with colored cursor
5. Type on B → appears on A with colored cursor
6. Rename file on A → B tab updates
7. Delete file on A → B shows toast
8. Close A → B promotes to host after 5s, writes new `collab.json`
9. Disable collab → `collab.json` deleted, clean disconnect
10. Status bar shows Users icon when active
11. Verify `.cascade/collab.json` has heartbeat updating every 5s
12. Verify no password in `.cascade/settings.json`

- [ ] **Step 4: Commit fixes**

```bash
git add -A && git commit -m "test(collab): integration fixes"
```

---

## Summary

| Task | Description | Steps |
|------|-------------|-------|
| 1 | Add dependencies | 4 |
| 2 | Shared types + presence file (Rust) | 6 |
| 3 | WebSocket relay server (Rust) | 3 |
| 4 | Frontend message types | 4 |
| 5 | Tauri commands | 4 |
| 6 | Frontend IPC + store + init stubs | 5 |
| 7 | Custom Yjs WebSocket provider | 4 |
| 8 | Y.Doc manager | 4 |
| 9 | CodeMirror collab extension | 5 |
| 10 | File watcher + save + presence detection | 5 |
| 11 | File lifecycle events | 2 |
| 12 | Settings UI + i18n | 6 |
| 13 | Status bar indicator | 2 |
| 14 | Full initialization glue | 4 |
| 15 | Integration testing | 4 |
| **Total** | | **62 steps** |
