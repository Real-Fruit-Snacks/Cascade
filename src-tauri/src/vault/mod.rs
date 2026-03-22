use std::fs;
use std::path::{Path, PathBuf};

use crate::error::CascadeError;
use crate::types::FileEntry;
use crate::{CachedTree, VaultRoot};

pub mod export;
pub mod file_io;
pub mod file_ops;
pub mod history;
pub mod plugins;
pub mod settings;
pub mod themes;
pub mod trash;

// Re-export everything from sub-modules (glob brings the hidden __cmd__ tauri wrappers too)
pub use export::*;
pub use file_io::*;
pub use file_ops::*;
pub use history::*;
pub use plugins::*;
pub use settings::*;
pub use themes::*;
pub use trash::*;

// Shared constants used across sub-modules
pub(crate) const PLUGINS_DIR: &str = ".cascade/plugins";
pub(crate) const THEMES_DIR: &str = ".cascade/themes";
pub(crate) const TRASH_DIR: &str = ".trash";
pub(crate) const SETTINGS_DIR: &str = ".cascade";
pub(crate) const SETTINGS_FILE: &str = ".cascade/settings.json";

/// Get canonical root: prefer the cached AppState value, fall back to canonicalizing the string.
pub(crate) fn get_canonical_root(
    vault_root_str: &str,
    state: &tauri::State<VaultRoot>,
) -> Result<PathBuf, CascadeError> {
    let guard = state.inner().0.lock().unwrap_or_else(|e| e.into_inner());
    if let Some(cached) = guard.clone() {
        return Ok(cached);
    }
    drop(guard);
    Ok(PathBuf::from(vault_root_str).canonicalize()?)
}

/// Validate a path against a pre-canonicalized root (avoids repeated canonicalize syscalls).
pub(crate) fn validate_path_canonical(canonical_root: &Path, requested: &str) -> Result<PathBuf, CascadeError> {
    if requested.contains('\0') {
        return Err(CascadeError::InvalidPath("path contains null byte".to_string()));
    }

    let full_path = canonical_root.join(requested);
    let canonical_requested = if full_path.exists() {
        full_path.canonicalize()?
    } else {
        // Walk up from full_path to find the deepest existing ancestor,
        // canonicalize it, then re-append the non-existent segments.
        // This allows creating files at paths like "a/b/c/file.md" where
        // intermediate directories don't exist yet.
        let mut existing = full_path.as_path();
        let mut tail_segments: Vec<&std::ffi::OsStr> = Vec::new();
        loop {
            if existing.exists() {
                break;
            }
            if let Some(name) = existing.file_name() {
                tail_segments.push(name);
                existing = existing.parent().unwrap_or(canonical_root);
            } else {
                break;
            }
        }
        let canonical_base = existing.canonicalize()?;
        let mut result = canonical_base;
        for seg in tail_segments.into_iter().rev() {
            result = result.join(seg);
        }
        result
    };
    if !canonical_requested.starts_with(canonical_root) {
        return Err(CascadeError::PathTraversal {
            requested: canonical_requested.to_string_lossy().into_owned(),
            vault: canonical_root.to_string_lossy().into_owned(),
        });
    }

    if canonical_requested.exists() && canonical_requested.symlink_metadata()?.file_type().is_symlink() {
        return Err(CascadeError::InvalidPath("symlinks are not allowed".to_string()));
    }

    Ok(canonical_requested)
}

pub fn build_tree_pub(dir: &Path, vault_root: &Path) -> Vec<FileEntry> {
    build_tree(dir, vault_root)
}

fn build_tree(dir: &Path, vault_root: &Path) -> Vec<FileEntry> {
    let mut entries: Vec<FileEntry> = Vec::new();

    let read_dir = match fs::read_dir(dir) {
        Ok(rd) => rd,
        Err(_) => return entries,
    };

    let mut items: Vec<_> = read_dir.filter_map(|e| e.ok()).collect();
    items.sort_by_key(|e| {
        let is_file = e.file_type().map(|ft| ft.is_file()).unwrap_or(false);
        (is_file, e.file_name())
    });

    for entry in items {
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();

        // Skip dotfile directories and dotfiles
        if name.starts_with('.') {
            continue;
        }

        let is_dir = entry.file_type().map(|ft| ft.is_dir()).unwrap_or(false);
        let rel_path = path
            .strip_prefix(vault_root)
            .unwrap_or(&path)
            .to_string_lossy()
            .replace('\\', "/");

        let modified = entry
            .metadata()
            .and_then(|m| m.modified())
            .ok()
            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|d: std::time::Duration| d.as_secs_f64())
            .unwrap_or(0.0);

        let children = if is_dir {
            Some(build_tree(&path, vault_root))
        } else {
            None
        };

        entries.push(FileEntry {
            name,
            path: rel_path,
            is_dir,
            children,
            modified,
        });
    }

    entries
}

#[tauri::command]
pub async fn open_vault(
    path: String,
    app_handle: tauri::AppHandle,
    vault_root_state: tauri::State<'_, VaultRoot>,
    cached_tree: tauri::State<'_, CachedTree>,
) -> Result<Vec<FileEntry>, CascadeError> {
    let vault_root = PathBuf::from(&path);
    if !vault_root.is_dir() {
        return Err(CascadeError::NotADirectory(path.clone()));
    }
    // Cache the canonical root so all subsequent commands avoid repeated syscalls
    let canonical_root = vault_root.canonicalize()?;
    {
        let mut guard = vault_root_state.inner().0.lock().unwrap_or_else(|e| e.into_inner());
        *guard = Some(canonical_root.clone());
    }
    let root = canonical_root.clone();
    let tree = tauri::async_runtime::spawn_blocking(move || build_tree(&root, &root))
        .await
        .map_err(|e| CascadeError::Io(std::io::Error::other(e.to_string())))?;
    {
        let mut guard = cached_tree.inner().0.lock().unwrap_or_else(|e| e.into_inner());
        *guard = Some(tree.clone());
    }
    // Start watching the vault for external changes
    crate::watcher::start_watcher(app_handle, path);
    Ok(tree)
}

/// List files without restarting the file watcher.
/// Used by refreshTree to avoid tearing down and re-creating the watcher.
#[tauri::command]
pub async fn list_files(
    path: String,
    cached_tree: tauri::State<'_, CachedTree>,
) -> Result<Vec<FileEntry>, CascadeError> {
    let vault_root = PathBuf::from(&path);
    if !vault_root.is_dir() {
        return Err(CascadeError::NotADirectory(path));
    }
    let root = vault_root.clone();
    let tree = tauri::async_runtime::spawn_blocking(move || build_tree(&root, &root))
        .await
        .map_err(|e| CascadeError::Io(std::io::Error::other(e.to_string())))?;
    {
        let mut guard = cached_tree.inner().0.lock().unwrap_or_else(|e| e.into_inner());
        *guard = Some(tree.clone());
    }
    Ok(tree)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn make_temp_vault() -> (tempfile::TempDir, PathBuf) {
        let dir = tempfile::tempdir().expect("failed to create temp dir");
        // Use a non-dotfile subdirectory so path validation and WalkDir work
        // correctly on Windows (tempfile dirs are named ".tmpXXX" which would
        // be pruned by dotfile filters if used directly as vault root).
        let vault = dir.path().join("vault");
        std::fs::create_dir_all(&vault).expect("failed to create vault subdir");
        let canonical = vault.canonicalize().expect("failed to canonicalize vault dir");
        (dir, canonical)
    }

    #[test]
    fn test_valid_path_within_vault() {
        let (_dir, root) = make_temp_vault();
        let result = validate_path_canonical(&root, "notes/hello.md");
        assert!(result.is_ok(), "valid relative path should succeed: {:?}", result);
        let path = result.unwrap();
        assert!(path.starts_with(&root));
    }

    #[test]
    fn test_valid_path_root_level() {
        let (_dir, root) = make_temp_vault();
        let result = validate_path_canonical(&root, "readme.md");
        assert!(result.is_ok());
        assert!(result.unwrap().starts_with(&root));
    }

    #[test]
    fn test_path_traversal_dotdot_rejected() {
        let (_dir, root) = make_temp_vault();
        let result = validate_path_canonical(&root, "../outside.md");
        assert!(result.is_err());
        match result.unwrap_err() {
            CascadeError::PathTraversal { .. } => {}
            other => panic!("expected PathTraversal, got: {:?}", other),
        }
    }

    #[test]
    fn test_path_traversal_deep_dotdot_rejected() {
        let (_dir, root) = make_temp_vault();
        // Create a real subdirectory so canonicalize can walk up
        fs::create_dir_all(root.join("a/b")).unwrap();
        let result = validate_path_canonical(&root, "a/b/../../../outside.md");
        assert!(result.is_err());
        match result.unwrap_err() {
            CascadeError::PathTraversal { .. } => {}
            other => panic!("expected PathTraversal, got: {:?}", other),
        }
    }

    #[test]
    fn test_null_byte_in_path_rejected() {
        let (_dir, root) = make_temp_vault();
        let result = validate_path_canonical(&root, "notes/hel\0lo.md");
        assert!(result.is_err());
        match result.unwrap_err() {
            CascadeError::InvalidPath(msg) => assert!(msg.contains("null byte")),
            other => panic!("expected InvalidPath(null byte), got: {:?}", other),
        }
    }

    #[test]
    fn test_existing_file_within_vault() {
        let (_dir, root) = make_temp_vault();
        // Create a real file so the exist-path in validate_path_canonical is exercised
        let file_path = root.join("existing.md");
        fs::write(&file_path, "content").unwrap();
        let result = validate_path_canonical(&root, "existing.md");
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), file_path.canonicalize().unwrap());
    }

    #[test]
    fn test_nonexistent_nested_path_allowed() {
        let (_dir, root) = make_temp_vault();
        // Path does not exist yet — should still succeed (for file creation)
        let result = validate_path_canonical(&root, "subdir/new-note.md");
        assert!(result.is_ok());
        let path = result.unwrap();
        assert!(path.starts_with(&root));
    }

    #[test]
    fn test_empty_path_stays_within_vault() {
        let (_dir, root) = make_temp_vault();
        // An empty string joins to root itself — should be ok (starts_with itself)
        let result = validate_path_canonical(&root, "");
        // Empty path resolves to the root — valid (not a traversal)
        assert!(result.is_ok());
    }
}
