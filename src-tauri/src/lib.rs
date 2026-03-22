mod bear_importer;
mod error;
mod fts;
mod git;
mod importer;
mod indexer;
mod notion_importer;
mod query;
mod roam_importer;
mod search;
mod sync_log;
mod types;
mod vault;
mod watcher;

use fts::FtsState;
use watcher::{SuppressTimestamp, WatcherState};

/// Cached canonical vault root path — populated by open_vault(), read on every command.
pub struct VaultRoot(pub std::sync::Mutex<Option<std::path::PathBuf>>);

/// Cached in-memory file tree — patched incrementally on fs events.
pub struct CachedTree(pub std::sync::Mutex<Option<Vec<crate::types::FileEntry>>>);

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(WatcherState(std::sync::Mutex::new(None)))
        .manage(SuppressTimestamp(std::sync::Mutex::new(std::collections::HashMap::new())))
        .manage(VaultRoot(std::sync::Mutex::new(None)))
        .manage(CachedTree(std::sync::Mutex::new(None)))
        .manage(FtsState(std::sync::Mutex::new(None)))
        .invoke_handler(tauri::generate_handler![
            vault::open_vault,
            vault::list_files,
            vault::read_file,
            vault::read_file_binary,
            vault::write_file,
            vault::create_file,
            vault::delete_file,
            vault::create_folder,
            vault::rename_file,
            vault::move_file,
            vault::trash_file,
            vault::export_file,
            vault::export_binary,
            vault::batch_export,
            vault::save_attachment,
            vault::read_vault_settings,
            vault::write_vault_settings,
            vault::list_plugins,
            vault::list_custom_themes,
            vault::save_custom_theme,
            vault::delete_custom_theme,
            vault::copy_template_folder,
            vault::list_file_history,
            vault::read_file_history,
            indexer::build_index,
            query::query_properties,
            search::search_vault,
            search::replace_in_files,
            importer::read_obsidian_config,
            notion_importer::import_notion_export,
            roam_importer::import_roam_export,
            bear_importer::import_bear_export,
            vault::read_custom_dictionary,
            vault::write_custom_dictionary,
            vault::compute_plugin_checksums,
            vault::write_integrity_file,
            vault::verify_plugin_integrity,
            vault::extract_plugin_zip,
            vault::list_trash,
            vault::restore_from_trash,
            vault::delete_from_trash,
            vault::empty_trash,
            git::git_test_connection,
            git::git_init_repo,
            git::git_clone_repo,
            git::git_sync,
            git::git_status,
            git::git_disconnect,
            git::open_sync_log_folder,
            git::store_sync_pat,
            git::has_sync_pat,
            git::delete_sync_pat,
            sync_log::write_sync_log,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
