use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::{Duration, Instant};

use notify::RecommendedWatcher;
use notify_debouncer_full::{new_debouncer, DebounceEventResult, Debouncer, FileIdMap};
use tauri::{AppHandle, Emitter, Manager};

use crate::types::{FileEntry, FsChangeEvent};

pub struct WatcherState(pub Mutex<Option<Debouncer<RecommendedWatcher, FileIdMap>>>);
/// Per-file suppress map: only suppresses watcher events for files the app recently wrote,
/// instead of globally dropping all events for 1 second.
pub struct SuppressTimestamp(pub Mutex<HashMap<PathBuf, Instant>>);

/// Remove the entry at `rel_path` from the tree. Returns true if removed.
fn tree_remove(tree: &mut Vec<FileEntry>, rel_path: &str) -> bool {
    let first_seg = rel_path.split('/').next().unwrap_or("");
    let rest = rel_path[first_seg.len()..].trim_start_matches('/');

    if rest.is_empty() {
        // Remove at this level
        if let Some(pos) = tree.iter().position(|e| e.name == first_seg) {
            tree.remove(pos);
            return true;
        }
        return false;
    }

    // Recurse into matching directory
    for entry in tree.iter_mut() {
        if entry.name == first_seg {
            if let Some(children) = &mut entry.children {
                return tree_remove(children, rest);
            }
        }
    }
    false
}

/// Insert or update `new_entry` at the directory given by `dir_rel_path` in the tree.
/// `dir_rel_path` is empty string for the vault root.
fn tree_insert(tree: &mut Vec<FileEntry>, dir_rel_path: &str, new_entry: FileEntry) {
    if dir_rel_path.is_empty() {
        // Insert/replace at root level
        if let Some(pos) = tree.iter().position(|e| e.name == new_entry.name) {
            tree[pos] = new_entry;
        } else {
            tree.push(new_entry);
            tree.sort_by(|a, b| {
                // Dirs before files, then alphabetical
                match (a.is_dir, b.is_dir) {
                    (true, false) => std::cmp::Ordering::Less,
                    (false, true) => std::cmp::Ordering::Greater,
                    _ => a.name.cmp(&b.name),
                }
            });
        }
        return;
    }

    let first_seg = dir_rel_path.split('/').next().unwrap_or("");
    let rest = dir_rel_path[first_seg.len()..].trim_start_matches('/');

    for entry in tree.iter_mut() {
        if entry.name == first_seg {
            if let Some(children) = &mut entry.children {
                tree_insert(children, rest, new_entry);
            }
            return;
        }
    }
}

/// Build a single FileEntry for a path (file or dir).
fn make_entry(path: &Path, vault_root: &Path) -> Option<FileEntry> {
    let name = path.file_name()?.to_string_lossy().to_string();
    if name.starts_with('.') {
        return None;
    }
    let rel_path = path
        .strip_prefix(vault_root)
        .unwrap_or(path)
        .to_string_lossy()
        .replace('\\', "/");
    let is_dir = path.is_dir();
    let modified = path
        .metadata()
        .and_then(|m| m.modified())
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_secs_f64())
        .unwrap_or(0.0);
    let children = if is_dir {
        Some(crate::vault::build_tree_pub(path, vault_root))
    } else {
        None
    };
    Some(FileEntry { name, path: rel_path, is_dir, children, modified })
}

pub fn start_watcher(app_handle: AppHandle, vault_path: String) {
    // Drop old watcher first
    {
        let watcher_state = app_handle.state::<WatcherState>();
        let mut guard = watcher_state.0.lock().unwrap();
        *guard = None;
    }

    let vault_root = PathBuf::from(&vault_path);
    let app_handle_clone = app_handle.clone();

    let debouncer = new_debouncer(
        Duration::from_millis(500),
        None,
        move |result: DebounceEventResult| {
            let events = match result {
                Ok(events) => events,
                Err(_) => return,
            };

            // Clean up expired entries from per-file suppress map
            {
                let suppress_state = app_handle_clone.state::<SuppressTimestamp>();
                let mut guard = suppress_state.0.lock().unwrap();
                guard.retain(|_, ts| ts.elapsed() < Duration::from_secs(2));
            }

            let vault_root_state = app_handle_clone.state::<crate::VaultRoot>();
            let cached_tree_state = app_handle_clone.state::<crate::CachedTree>();
            let canonical_vault = {
                let g = vault_root_state.inner().0.lock().unwrap_or_else(|e| e.into_inner());
                g.clone()
            };

            // Count total changed paths to detect bulk operations
            let total_paths: usize = events.iter()
                .flat_map(|e| e.paths.iter())
                .filter(|p| !p.components().any(|c| c.as_os_str().to_string_lossy().starts_with('.')))
                .count();

            const BULK_THRESHOLD: usize = 50;

            if total_paths >= BULK_THRESHOLD {
                // Bulk change detected (e.g. git checkout) — full tree rebuild
                if let Some(ref vault_root) = canonical_vault {
                    let new_tree = crate::vault::build_tree_pub(vault_root, vault_root);
                    let mut guard = cached_tree_state.inner().0.lock().unwrap_or_else(|e| e.into_inner());
                    *guard = Some(new_tree.clone());
                    let _ = app_handle_clone.emit("vault://tree-updated", new_tree);
                }
                // Also emit fs-change for the frontend to refresh open files
                let _ = app_handle_clone.emit("vault://fs-change", &FsChangeEvent {
                    kind: "bulk".to_string(),
                    path: String::new(),
                });
            } else {
                for event in &events {
                    for path in &event.paths {
                        // Skip dotfile directories
                        let skip = path.components().any(|c| {
                            c.as_os_str().to_string_lossy().starts_with('.')
                        });
                        if skip {
                            continue;
                        }

                        let kind = match event.kind {
                            notify::EventKind::Create(_) => "create",
                            notify::EventKind::Modify(_) => "modify",
                            notify::EventKind::Remove(_) => "remove",
                            _ => continue,
                        };

                        // Per-file suppress: skip events for files the app recently wrote
                        {
                            let suppress_state = app_handle_clone.state::<SuppressTimestamp>();
                            let guard = suppress_state.0.lock().unwrap();
                            if let Some(ts) = guard.get(path) {
                                if ts.elapsed() < Duration::from_secs(1) {
                                    continue;
                                }
                            }
                        }

                        let path_str = path.to_string_lossy().replace('\\', "/");
                        let fs_event = FsChangeEvent {
                            kind: kind.to_string(),
                            path: path_str,
                        };
                        let _ = app_handle_clone.emit("vault://fs-change", &fs_event);

                        // Incremental FTS update
                        // Read file content BEFORE acquiring the FTS mutex to avoid
                        // blocking concurrent search queries during disk I/O
                        if let Some(ref vault_root) = canonical_vault {
                            if path.extension().and_then(|e| e.to_str()) == Some("md") {
                                let rel = path.strip_prefix(vault_root)
                                    .unwrap_or(path)
                                    .to_string_lossy()
                                    .replace('\\', "/");
                                let content = match kind {
                                    "create" | "modify" => std::fs::read_to_string(path).ok(),
                                    _ => None,
                                };
                                let fts_s = app_handle_clone.state::<crate::fts::FtsState>();
                                let fts_guard = fts_s.0.lock().unwrap_or_else(|e| e.into_inner());
                                if let Some(ref conn) = *fts_guard {
                                    match kind {
                                        "remove" => { crate::fts::remove_file(conn, &rel); }
                                        "create" | "modify" => {
                                            if let Some(ref text) = content {
                                                crate::fts::update_file(conn, &rel, text);
                                            }
                                        }
                                        _ => {}
                                    }
                                }
                                drop(fts_guard);
                            }
                        }

                        // Incremental tree patch for create/remove
                        if let Some(ref vault_root) = canonical_vault {
                            let rel = match path.strip_prefix(vault_root) {
                                Ok(r) => r.to_string_lossy().replace('\\', "/"),
                                Err(_) => continue,
                            };

                            // T4: Do blocking I/O (make_entry) outside the mutex lock
                            let new_entry = if kind == "create" {
                                make_entry(path, vault_root)
                            } else {
                                None
                            };

                            let mut guard = cached_tree_state.inner().0.lock().unwrap_or_else(|e| e.into_inner());
                            if let Some(ref mut tree) = *guard {
                                match kind {
                                    "remove" => {
                                        tree_remove(tree, &rel);
                                    }
                                    "create" => {
                                        if let Some(entry) = new_entry {
                                            let parent_rel = rel.rsplit_once('/').map(|x| x.0).unwrap_or("");
                                            tree_insert(tree, parent_rel, entry);
                                        }
                                    }
                                    _ => {} // modify: no tree structure change
                                }
                                let _ = app_handle_clone.emit("vault://tree-updated", tree.clone());
                            }
                        }
                    }
                }
            }
        },
    );

    if let Ok(mut d) = debouncer {
        let watch_result = d.watch(&vault_root, notify::RecursiveMode::Recursive);
        if watch_result.is_ok() {
            let watcher_state = app_handle.state::<WatcherState>();
            let mut guard = watcher_state.0.lock().unwrap();
            *guard = Some(d);
        }
    }
}
