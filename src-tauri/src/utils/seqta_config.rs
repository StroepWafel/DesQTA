use serde_json::Value;
use std::{fs, io::Read, path::PathBuf};
use tauri::command;
use crate::profiles;

/// Returns the path to seqtaConfig.json in the profile directory.
fn config_file() -> PathBuf {
    let mut dir = profiles::get_profile_dir(
        &profiles::ProfileManager::get_current_profile()
            .map(|p| p.id)
            .unwrap_or_else(|| "default".to_string())
    );
    dir.push("seqtaConfig.json");
    dir
}

/// Loads the seqtaConfig.json as serde_json::Value. Returns None if not found.
#[command]
pub fn load_seqta_config() -> Option<Value> {
    let path = config_file();
    if let Ok(mut file) = fs::File::open(&path) {
        let mut contents = String::new();
        if file.read_to_string(&mut contents).is_ok() {
            if let Ok(json) = serde_json::from_str::<Value>(&contents) {
                return Some(json);
            }
        }
    }
    None
}

/// Saves the given serde_json::Value to seqtaConfig.json.
#[command]
pub fn save_seqta_config(config: Value) -> Result<(), String> {
    let path = config_file();
    fs::write(path, serde_json::to_string(&config).unwrap()).map_err(|e| e.to_string())
}

/// Checks if the current config is different from the given value.
#[command]
pub fn is_seqta_config_different(new_config: Value) -> bool {
    let current = load_seqta_config();
    match current {
        Some(existing) => existing != new_config,
        None => true,
    }
}
