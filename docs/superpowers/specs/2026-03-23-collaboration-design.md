# Real-Time Collaboration — Design Spec

## Overview

Multi-user real-time collaboration for Cascade, enabling multiple users to edit the same vault and files simultaneously with live cursors and presence. Designed for shared folder vaults on local networks. Toggleable in settings — off by default.

## Architecture

### Transport
- **WebSocket server** embedded in Tauri's Rust backend, auto-started when collaboration is enabled
- **mDNS** (zero-config) for local network vault discovery
- Vault password required to connect
- **Plaintext WebSocket (ws://) accepted for v1** on trusted local networks. TLS with self-signed certs is a future enhancement.

### Host Election
- First instance to enable collaboration broadcasts via mDNS and starts a WebSocket server
- **Race condition tiebreaker:** when an instance starts, it listens for mDNS for 2 seconds before broadcasting. If it discovers an existing host during that window, it becomes a client instead. If two instances start within the same window, the one with the lexicographically lower machine ID (hostname + process start timestamp) yields to the other.
- **Host promotion on disconnect:** longest-connected client becomes the new host. The new host starts its own WebSocket server and re-broadcasts via mDNS. Other clients detect the new mDNS entry and reconnect (Yjs sync protocol handles state recovery on reconnect — no data loss).
- **Split-brain prevention:** if the old host comes back, it discovers the new host via mDNS and joins as a client. A host that detects another host for the same vault immediately demotes itself.

### Document Sync (Yjs + CodeMirror)
- **Yjs** CRDT library for conflict-free real-time merging
- **y-codemirror.next** binding for CodeMirror 6 integration (live cursors, selections included)
- Every keystroke syncs via WebSocket (sub-50ms on local network)

### Sync Provider Architecture
- The Rust WebSocket server acts as a **dumb relay** — it broadcasts incoming binary messages to all other connected clients. It does NOT parse or store Yjs state.
- The frontend uses a **custom Yjs provider** (not the `y-websocket` Node.js package) that implements the Yjs binary sync protocol (sync step 1, sync step 2, update messages) over a standard WebSocket connection.
- This keeps the Rust side simple (just relay bytes) and all CRDT logic in the JS/TypeScript frontend where Yjs runs.

### File Saving
- The host is responsible for writing merged Y.Doc state to `.md` files on disk via normal auto-save
- Non-host clients do NOT save to disk
- When a new host is promoted, it takes over disk writing

### File Watcher Integration
- **When collaboration is active**, the file watcher behavior changes:
  - **Host:** suppresses watcher events for files it just wrote (existing suppress mechanism, extended with a collab-aware flag)
  - **Non-host clients:** ignore watcher events for files that have an active Y.Doc. The Y.Doc is the source of truth, not the disk. Watcher events for files WITHOUT an active Y.Doc are processed normally (e.g., a new file created outside Cascade).
  - **On disconnect/collab disabled:** file watcher returns to normal behavior, reloads from disk for any files that diverged.

### File Lifecycle During Collaboration
- **File rename:** the renaming user sends a lifecycle event over WebSocket. All clients update their Y.Doc key mapping. The old Y.Doc is re-keyed, not disposed — cursors and undo history are preserved.
- **File delete:** a lifecycle event is sent. Clients with the file open see a toast "File deleted by [name]" and the tab is marked as unsaved with the content still available. The user can save-as or close.
- **File create:** a lifecycle event triggers a tree refresh on all clients (the file watcher would catch this too, but the event is faster).

### Presence & Awareness
- Yjs awareness protocol broadcasts: name, color, cursor position, selection, active file
- Live cursors with colored name labels in the editor
- Active users panel showing connected users and what they're editing
- File tree dots indicating which files have active collaborators
- 3-second awareness timeout on disconnect

### Settings Profiles
- Users create named settings profiles
- Profile filename: user-chosen slug, sanitized (alphanumeric + hyphens only). e.g., "Matt" → `.cascade/settings-matt.json`
- **Name collision:** if the file already exists, append a number (`.cascade/settings-matt-2.json`)
- Profile-to-vault mapping stored locally per machine (`~/.cascade/profiles.json`)
- **Migration:** existing users see no change. Creating a profile copies current `.cascade/settings.json` to the new file. No migration of the default file needed.

### Enable/Disable UX
- New "Collaboration" category in Settings
- Toggle on: prompted for name + color + password (host) or name + color + vault selection (client)
- Toggle off: clean disconnect, files saved in merged state, returns to single-user mode
- Status bar indicator when active

## Performance Considerations
- **Large files (50k+ lines):** Yjs handles large documents well, but Y.Doc state grows with edit history. Periodic `Y.Doc.gc` (garbage collection) is enabled to compact tombstones.
- **Concurrent open files:** each open file is a separate Y.Doc. Memory is proportional to open files x edit history. Recommend a soft limit of ~20 concurrent collaborative files with a warning toast.
- **Connected clients:** WebSocket relay is lightweight. Practical limit ~10 concurrent users before bandwidth on a LAN becomes noticeable. No hard limit enforced in v1.
- **Y.Doc lifecycle:** when the last user closes a file, the Y.Doc is disposed and GC'd. On next open, a fresh Y.Doc is created from the markdown on disk.

## What Flows Over WebSocket
- Yjs document updates (binary, ~50-200 bytes per keystroke)
- Yjs awareness updates (cursor/selection/presence, ~100 bytes JSON)
- File lifecycle events (created, renamed, deleted — small JSON messages)
- Sync protocol handshake (sync step 1 + 2 on connect)

## What Does NOT Flow Over WebSocket
- File contents at rest (shared folder handles storage)
- Settings (each user has their own profile)

## Offline/Disconnect Behavior
- Collaboration features freeze on disconnect
- Local-only editing continues in normal single-user mode
- File watcher returns to normal behavior
- On reconnect, Yjs sync protocol recovers state automatically (sends missing updates since last sync)

## Identity
- Display name + color (chosen once, stored locally)
- Colors auto-assigned from Catppuccin palette
- No accounts — vault password is the only auth

## Phasing

### Phase 1: Settings Profiles (standalone, no collab dependency)
- Settings profile creation, switching, browsing
- Local profile mapping per vault per machine
- Benefits all users even without collaboration

### Phase 2: Real-time Collaboration Core
- WebSocket server in Rust backend (dumb relay)
- mDNS discovery + password auth
- Custom Yjs WebSocket provider on frontend
- Yjs document sync with CodeMirror binding
- Live cursors and selections via y-codemirror.next
- Host election with tiebreaker + basic disconnect detection + auto-promotion
- File watcher collab-aware mode
- File lifecycle events (rename, delete, create)
- Enable/disable toggle and setup flow

### Phase 3: Presence & Polish
- Active users sidebar panel
- File tree presence indicators
- Status bar collaboration indicator
- Reconnect UX (auto-retry with backoff)
- Y.Doc garbage collection tuning
- Performance profiling and soft limits

## Technology Stack
- **Yjs** — CRDT document model
- **y-codemirror.next** — CodeMirror 6 binding with cursors/selections
- **Custom WebSocket provider** — lightweight Yjs sync protocol client (replaces y-websocket)
- **mdns-sd** (Rust crate) — local network service discovery
- **tokio-tungstenite** (Rust) — WebSocket server in Tauri backend
- **argon2** (Rust) — password hashing for vault auth

## Not In Scope (v1)
- TLS encryption (trusted LAN assumption for v1)
- Remote/internet collaboration (would need relay server or tunneling)
- Per-file permissions
- Edit history / blame per user
- Voice/video/chat
- Hard limits on clients or file count
