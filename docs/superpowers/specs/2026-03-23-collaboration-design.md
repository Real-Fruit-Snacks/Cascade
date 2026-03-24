# Real-Time Collaboration — Design Spec

## Overview

Multi-user real-time collaboration for Cascade, enabling multiple users to edit the same vault and files simultaneously with live cursors and presence. Designed for shared folder vaults on local networks — all users open the same vault from a shared location (SMB, NFS, etc.). Toggleable in settings — off by default.

## Architecture

### Transport
- **WebSocket server** embedded in Tauri's Rust backend, auto-started when collaboration is enabled
- **Presence file** (`.cascade/collab.json`) in the vault for host discovery — the shared folder IS the discovery mechanism
- Vault password required to connect
- **Plaintext WebSocket (ws://) accepted for v1** on trusted local networks. TLS with self-signed certs is a future enhancement.

### Host Discovery via Presence File
- When a user enables collaboration, Cascade checks for `.cascade/collab.json` in the vault
- **If the file exists and heartbeat is fresh** (< 15 seconds old): connect as client to the listed host
- **If the file is missing or heartbeat is stale**: become host — start WebSocket server, write `collab.json`
- The host updates the heartbeat timestamp every 5 seconds
- On clean shutdown: host deletes `collab.json`
- On crash: heartbeat goes stale, clients detect and promote

```json
{
  "host": "192.168.1.5",
  "port": 9123,
  "startedAt": 1711324800000,
  "heartbeat": 1711324815000
}
```

### Host Election
- First instance to enable collaboration and find no fresh presence file becomes host
- **Race condition (two users enable simultaneously):** both may start servers and write `collab.json`. The file watcher detects the overwrite — the host whose info is NOT in the current file demotes itself and connects as client. Last writer wins; natural resolution via file watcher.
- **Host promotion on disconnect:** when the host stops or crashes (heartbeat stale > 15s), the longest-connected client promotes itself — starts a new WebSocket server and writes a new `collab.json`. Other clients detect the new file via watcher and reconnect.
- **Split-brain prevention:** a host that detects `collab.json` was overwritten with different host info immediately demotes itself and connects as client.

### Document Sync (Yjs + CodeMirror)
- **Yjs** CRDT library for conflict-free real-time merging
- **y-codemirror.next** binding for CodeMirror 6 integration (live cursors, selections included)
- **y-protocols** Awareness for broadcasting name, color, cursor position, selection
- Every keystroke syncs via WebSocket (sub-50ms on local network)

### Sync Provider Architecture
- The Rust WebSocket server acts as a **dumb relay** — it broadcasts incoming binary messages to all other connected clients. It does NOT parse or store Yjs state.
- The frontend uses a **custom Yjs provider** (not the `y-websocket` Node.js package) that implements the Yjs binary sync protocol (sync step 1, sync step 2, update messages) over a standard WebSocket connection.
- This keeps the Rust side simple (just relay bytes) and all CRDT logic in the JS/TypeScript frontend where Yjs runs.

### File Saving
- The host is responsible for writing merged Y.Doc state to `.md` files on disk via normal auto-save
- Non-host clients do NOT save to disk (shared folder — host handles storage)
- When a new host is promoted, it takes over disk writing

### File Watcher Integration
- **When collaboration is active**, the file watcher behavior changes:
  - **Host:** suppresses watcher events for files it just wrote (existing suppress mechanism, extended with a collab-aware flag). Also watches `collab.json` for overwrites (split-brain detection).
  - **Non-host clients:** ignore watcher events for files that have an active Y.Doc. The Y.Doc is the source of truth, not the disk. Watcher events for files WITHOUT an active Y.Doc are processed normally (e.g., a new file created outside Cascade). Watches `collab.json` for heartbeat changes and host transitions.
  - **On disconnect/collab disabled:** file watcher returns to normal behavior, reloads from disk for any files that diverged.

### File Lifecycle During Collaboration
- **File rename:** the renaming user sends a lifecycle event over WebSocket. All clients update their Y.Doc key mapping. The old Y.Doc is re-keyed, not disposed — cursors and undo history are preserved.
- **File delete:** a lifecycle event is sent. Clients with the file open see a toast "File deleted by [name]" and the tab is marked as unsaved with the content still available. The user can save-as or close.
- **File create:** a lifecycle event triggers a tree refresh on all clients (the file watcher would catch this too, but the event is faster).

### Presence & Awareness
- Yjs awareness protocol broadcasts: name, color, cursor position, selection, active file
- Live cursors with colored name labels in the editor
- Active users panel showing connected users and what they're editing (Phase 3)
- File tree dots indicating which files have active collaborators (Phase 3)
- 3-second awareness timeout on disconnect

### Settings Profiles
- Users create named settings profiles (Phase 1 — already implemented)
- Profile filename: user-chosen slug, sanitized. e.g., "Matt" → `.cascade/settings-matt.json`
- Profile-to-vault mapping stored locally per machine

### Enable/Disable UX
- New "Collaboration" category in Settings
- Toggle on: enter name + color + password → auto-detects host via presence file
- Toggle off: clean disconnect, files saved in merged state, returns to single-user mode
- Status bar indicator when active

## Performance Considerations
- **Large files (50k+ lines):** Yjs handles large documents well, but Y.Doc state grows with edit history. `Y.Doc.gc` enabled to compact tombstones.
- **Concurrent open files:** each open file is a separate Y.Doc. Memory proportional to open files × edit history. Soft limit ~20 concurrent collaborative files with warning toast.
- **Connected clients:** WebSocket relay is lightweight. Practical limit ~10 concurrent users on LAN. No hard limit in v1.
- **Y.Doc lifecycle:** when the last user closes a file, the Y.Doc is disposed and GC'd. On next open, a fresh Y.Doc is created from the markdown on disk.

## What Flows Over WebSocket
- Yjs document updates (binary, ~50-200 bytes per keystroke)
- Yjs awareness updates (cursor/selection/presence, ~100 bytes)
- File lifecycle events (created, renamed, deleted — small JSON messages)
- Sync protocol handshake (sync step 1 + 2 on connect)

## What Does NOT Flow Over WebSocket
- File contents at rest (shared folder handles storage)
- Settings (each user has their own profile)

## Offline/Disconnect Behavior
- Collaboration features freeze on disconnect
- Local-only editing continues in normal single-user mode
- File watcher returns to normal behavior
- On reconnect, Yjs sync protocol recovers state automatically

## Identity
- Display name + color (stored in settings profile, persisted per vault)
- Colors chosen from Catppuccin palette
- No accounts — vault password is the only auth
- Password prompted each session, never saved to disk

## Phasing

### Phase 1: Settings Profiles (standalone, no collab dependency) ✅
- Settings profile creation, switching, browsing
- Local profile mapping per vault per machine

### Phase 2: Real-time Collaboration Core
- WebSocket server in Rust backend (dumb relay)
- Presence file discovery (`.cascade/collab.json`) + password auth
- Custom Yjs WebSocket provider on frontend
- Yjs document sync with CodeMirror binding
- Live cursors and selections via y-codemirror.next + Awareness
- Host election via presence file + heartbeat + auto-promotion
- File watcher collab-aware mode
- File lifecycle events (rename, delete, create)
- Enable/disable toggle and setup flow
- Status bar collaboration indicator

### Phase 3: Presence & Polish
- Active users sidebar panel
- File tree presence indicators
- Reconnect UX improvements
- Y.Doc garbage collection tuning
- Performance profiling and soft limits

## Technology Stack
- **Yjs** — CRDT document model
- **y-codemirror.next** — CodeMirror 6 binding with cursors/selections
- **y-protocols** — Awareness protocol for presence
- **Custom WebSocket provider** — lightweight Yjs sync protocol client
- **tokio-tungstenite** (Rust) — WebSocket server in Tauri backend
- **argon2** (Rust) — password hashing for vault auth
- **local-ip-address** (Rust) — determine LAN IP for presence file

## Not In Scope (v1)
- TLS encryption (trusted LAN assumption for v1)
- Remote/internet collaboration (would need relay server or tunneling)
- mDNS / zero-config network discovery (not needed — shared folder is discovery)
- Per-file permissions
- Edit history / blame per user
- Voice/video/chat
- Hard limits on clients or file count
