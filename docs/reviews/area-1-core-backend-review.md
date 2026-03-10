# Area 1: Core Backend (Rust) Review

## User Perspective
- [x] [medium] `list_file_history` could expose directory listings outside intended history scope via path traversal
- [x] [low] Error messages from Rust backend are technical — `PathTraversal` errors show raw paths; acceptable for dev but could be friendlier

## Developer Perspective
- [x] [critical] `list_file_history` has no path validation on `path` param — joins user input directly to history dir, enabling traversal with `../` segments
- [x] [critical] `extract_plugin_zip` only checks `name.contains("..")` — doesn't handle absolute paths in zip entries (e.g., `/etc/passwd`)
- [x] [medium] `write_integrity_file` (vault.rs:882) uses `unwrap()` on `SystemTime::now().duration_since()` — should use `unwrap_or_default()`
- [x] [medium] `write_integrity_file` (vault.rs:888) uses `unwrap()` on `serde_json::to_string_pretty()` — should propagate error
- [x] [medium] `compute_plugin_checksums` (vault.rs:853) uses `unwrap()` on `strip_prefix()` — should handle error
- [x] [medium] `INLINE_TAG_RE` regex is duplicated in `indexer.rs` and `query.rs` — should be shared
- [x] [medium] `build_index` in `indexer.rs` makes two full WalkDir passes (one for `.md`, one for `.canvas`) — can be combined
- [x] [medium] `watcher.rs` lines 107 and 265 use `unwrap()` on mutex locks instead of poison-safe `unwrap_or_else`
- [x] [low] `PropertyQuery.output` in `query.rs` is marked `#[allow(dead_code)]` — dead field
- [x] [low] `query.rs` has no test coverage
- [x] [nitpick] `list_files` in vault.rs doesn't use `VaultRoot` state for canonical root (minor inconsistency with other commands)

## Status: Complete
