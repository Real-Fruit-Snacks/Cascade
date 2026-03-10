# Area 9: Git Sync Review

## Files Reviewed
- `src-tauri/src/git.rs` — git operations backend
- `src/stores/sync-store.ts` — sync state management
- `src/components/SyncStatusIndicator.tsx` — sync UI indicator
- `src/hooks/use-sync-timer.ts` — auto-sync timer
- `src/components/SettingsModal.tsx` — sync settings section (SyncOptionsPage)

## Findings

### Rust Backend (git.rs)

- [x] Fixed: `signature()` called `.unwrap()` which could panic — changed to return `Result` with proper error propagation via `?` at all 4 call sites
- [x] Fixed: fetch error silently swallowed via `.is_err()` — now uses `if let Err(e)` and logs the actual error with `eprintln!`
- [x] Fixed: push error discarded the error message (`Err(_) => "offline"`) — now logs the error before returning offline status
- [ ] Deferred: `ensure_gitignore` silently ignores write errors (`let _ = fs::write(...)`) — low-risk since it only runs on first init
- [ ] Deferred: conflict resolution always keeps "our" side and writes `.conflict.md` for "their" side — works but users have no merge UI to compare/resolve properly

### Sync Store (sync-store.ts)

- [x] Fixed: `refreshStatus()` could overwrite `syncStatus` during an active sync (race condition) — added guard to skip if status is `'syncing'`
- [x] Fixed: error message matching only checked for `'auth'` — expanded to also detect `'401'`, `'403'`, `'404'`, and `'not found'` patterns with more actionable toast messages
- [ ] Deferred: `unpushedCommits` tracking when offline is approximate (increments by 1 per sync cycle with changes) — should call `refreshStatus` after reconnecting to get accurate count from git revwalk

### Sync Status Indicator (SyncStatusIndicator.tsx)

- [x] Fixed: clickable indicator had no keyboard accessibility — added `role="button"`, `tabIndex={0}`, `aria-label`, and `onKeyDown` handler for Enter/Space
- [x] Fixed: non-clickable states had no semantic role — added `role="status"` for screen readers
- [ ] Deferred: `formatAgo` function is duplicated in both `SyncStatusIndicator.tsx` and `SettingsModal.tsx` `SyncOptionsPage` — should extract to shared utility

### Auto-Sync Timer (use-sync-timer.ts)

- [x] Fixed: sync interval had no minimum floor — added `Math.max(..., 60_000)` to ensure interval is never less than 1 minute even if settings are corrupted

### Settings Modal (SyncOptionsPage in SettingsModal.tsx)

- [x] Fixed: PAT was saved to OS keyring on every keystroke — added 500ms debounce via `useRef` timer to batch saves
- [x] Fixed: connection status banner used same green color for both connected and offline states — offline now uses `var(--ctp-peach)` (matching SyncStatusIndicator's offline color) for background, border, and icon

## User Perspective Assessment

| Concern | Status |
|---------|--------|
| Sync status clear and accurate? | Good — distinct states for idle/syncing/error/offline/disconnected with appropriate colors |
| Conflict handling understandable? | Adequate — toast notification mentions `.conflict.md` files; users must manually review |
| Auto-sync interval configurable? | Good — dropdown with 1/5/10/30 min options, toggle to disable |
| Credential storage secure? | Good — PAT stored in OS keyring via `keyring` crate, excluded from disk settings via `EXCLUDED_FROM_DISK` |
| Error messages actionable? | Improved — auth and not-found errors now give specific guidance to check settings |

## Developer Perspective Assessment

| Concern | Status |
|---------|--------|
| Git error handling | Improved — signature no longer panics, fetch/push errors logged |
| Credential security | Solid — keyring-based, never written to settings JSON |
| Sync race conditions | Fixed — refreshStatus guards against overwriting syncing state |
| Status state machine | Correct — transitions are well-defined, guard prevents double-sync |
