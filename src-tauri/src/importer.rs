use std::collections::HashMap;
use std::path::PathBuf;

use crate::error::CascadeError;

#[derive(Debug, serde::Serialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct ImportResult {
    pub files_imported: u32,
    pub files_skipped: u32,
    pub errors: Vec<String>,
}

#[derive(serde::Serialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct ObsidianConfig {
    pub detected: bool,
    pub theme_mode: Option<String>,
    pub base_font_size: Option<f64>,
    pub vim_mode: Option<bool>,
    pub show_line_number: Option<bool>,
    pub spellcheck: Option<bool>,
    pub attachment_folder_path: Option<String>,
    pub new_file_location: Option<String>,
    pub template_folder: Option<String>,
    pub hotkeys: HashMap<String, String>,
}

#[tauri::command]
pub fn read_obsidian_config(vault_root: String) -> Result<ObsidianConfig, CascadeError> {
    let root = PathBuf::from(&vault_root);
    let obsidian_dir = root.join(".obsidian");

    if !obsidian_dir.is_dir() {
        return Ok(ObsidianConfig { detected: false, ..Default::default() });
    }

    let mut config = ObsidianConfig { detected: true, ..Default::default() };

    // Read app.json
    if let Ok(content) = std::fs::read_to_string(obsidian_dir.join("app.json")) {
        if let Ok(app) = serde_json::from_str::<serde_json::Value>(&content) {
            if let Some(v) = app.get("vimMode").and_then(|v| v.as_bool()) {
                config.vim_mode = Some(v);
            }
            if let Some(v) = app.get("showLineNumber").and_then(|v| v.as_bool()) {
                config.show_line_number = Some(v);
            }
            if let Some(v) = app.get("spellcheck").and_then(|v| v.as_bool()) {
                config.spellcheck = Some(v);
            }
            if let Some(v) = app.get("attachmentFolderPath").and_then(|v| v.as_str()) {
                config.attachment_folder_path = Some(v.to_string());
            }
            if let Some(v) = app.get("newFileLocation").and_then(|v| v.as_str()) {
                config.new_file_location = Some(v.to_string());
            }
        }
    }

    // Read appearance.json
    if let Ok(content) = std::fs::read_to_string(obsidian_dir.join("appearance.json")) {
        if let Ok(appearance) = serde_json::from_str::<serde_json::Value>(&content) {
            if let Some(v) = appearance.get("theme").and_then(|v| v.as_str()) {
                config.theme_mode = Some(v.to_string());
            }
            // Obsidian stores "moonstone" (light) or "obsidian" (dark)
            if config.theme_mode.is_none() {
                if let Some(v) = appearance.get("cssTheme").and_then(|v| v.as_str()) {
                    config.theme_mode = Some(v.to_string());
                }
            }
            if let Some(v) = appearance.get("baseFontSize").and_then(|v| v.as_f64()) {
                config.base_font_size = Some(v);
            }
        }
    }

    // Read core-plugins config for templates
    if let Ok(content) = std::fs::read_to_string(obsidian_dir.join("templates.json")) {
        if let Ok(templates) = serde_json::from_str::<serde_json::Value>(&content) {
            if let Some(v) = templates.get("folder").and_then(|v| v.as_str()) {
                config.template_folder = Some(v.to_string());
            }
        }
    }

    // Read daily-notes config
    if let Ok(content) = std::fs::read_to_string(obsidian_dir.join("daily-notes.json")) {
        if let Ok(daily) = serde_json::from_str::<serde_json::Value>(&content) {
            // Store daily notes config as hotkeys for now (reuse the map)
            if let Some(v) = daily.get("folder").and_then(|v| v.as_str()) {
                config.hotkeys.insert("dailyNotesFolder".to_string(), v.to_string());
            }
            if let Some(v) = daily.get("format").and_then(|v| v.as_str()) {
                config.hotkeys.insert("dailyNotesFormat".to_string(), v.to_string());
            }
            if let Some(v) = daily.get("template").and_then(|v| v.as_str()) {
                config.hotkeys.insert("dailyNotesTemplate".to_string(), v.to_string());
            }
        }
    }

    Ok(config)
}
