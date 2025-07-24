use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::command;

#[cfg(not(target_os = "android"))]
use dirs_next;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SearchItem {
    pub id: String,
    pub name: String,
    pub path: String,
    pub category: String,
    pub description: Option<String>,
    pub keywords: Option<Vec<String>>,
    pub shortcut: Option<String>,
    pub badge: Option<String>,
    pub priority: Option<i32>,
    pub last_used: Option<String>,
    pub use_count: Option<i32>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SearchStats {
    pub total_searches: i32,
    pub average_time: f64,
    pub last_search_time: Option<String>,
    pub most_used_categories: Vec<String>,
}

impl Default for SearchStats {
    fn default() -> Self {
        Self {
            total_searches: 0,
            average_time: 0.0,
            last_search_time: None,
            most_used_categories: Vec::new(),
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GlobalSearchData {
    pub search_history: Vec<String>,
    pub favorite_items: Vec<String>,
    pub recent_items: Vec<SearchItem>,
    pub search_stats: SearchStats,
    pub custom_shortcuts: Vec<SearchItem>,
    pub disabled_categories: Vec<String>,
    pub search_preferences: SearchPreferences,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SearchPreferences {
    pub max_history_items: i32,
    pub max_recent_items: i32,
    pub enable_fuzzy_search: bool,
    pub enable_command_mode: bool,
    pub show_descriptions: bool,
    pub auto_save: bool,
    pub search_delay_ms: i32,
}

impl Default for SearchPreferences {
    fn default() -> Self {
        Self {
            max_history_items: 50,
            max_recent_items: 10,
            enable_fuzzy_search: true,
            enable_command_mode: true,
            show_descriptions: true,
            auto_save: true,
            search_delay_ms: 150,
        }
    }
}

impl Default for GlobalSearchData {
    fn default() -> Self {
        Self {
            search_history: Vec::new(),
            favorite_items: Vec::new(),
            recent_items: Vec::new(),
            search_stats: SearchStats::default(),
            custom_shortcuts: Vec::new(),
            disabled_categories: Vec::new(),
            search_preferences: SearchPreferences::default(),
        }
    }
}

/// Location: `$DATA_DIR/DesQTA/global_search.json`
fn get_search_data_path() -> PathBuf {
    #[cfg(target_os = "android")]
    {
        // On Android, use the app's internal storage directory
        let mut dir = PathBuf::from("/data/data/com.desqta.app/files");
        dir.push("DesQTA");
        if !dir.exists() {
            fs::create_dir_all(&dir).expect("Unable to create data dir");
        }
        dir.push("global_search.json");
        dir
    }
    #[cfg(not(target_os = "android"))]
    {
        let mut dir = dirs_next::data_dir().expect("Unable to determine data dir");
        dir.push("DesQTA");
        if !dir.exists() {
            fs::create_dir_all(&dir).expect("Unable to create data dir");
        }
        dir.push("global_search.json");
        dir
    }
}

#[command]
pub fn get_global_search_data() -> Result<GlobalSearchData, String> {
    let path = get_search_data_path();
    
    if !path.exists() {
        return Ok(GlobalSearchData::default());
    }
    
    let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let data: GlobalSearchData = serde_json::from_str(&content)
        .unwrap_or_else(|_| GlobalSearchData::default());
    
    Ok(data)
}

#[command]
pub fn save_global_search_data(data: GlobalSearchData) -> Result<(), String> {
    let path = get_search_data_path();
    
    // Ensure the directory exists
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    
    let json = serde_json::to_string_pretty(&data).map_err(|e| e.to_string())?;
    fs::write(&path, json).map_err(|e| e.to_string())?;
    
    Ok(())
}

#[command]
pub fn clear_search_history() -> Result<(), String> {
    let mut data = get_global_search_data()?;
    data.search_history.clear();
    save_global_search_data(data)?;
    Ok(())
}

#[command]
pub fn clear_recent_items() -> Result<(), String> {
    let mut data = get_global_search_data()?;
    data.recent_items.clear();
    save_global_search_data(data)?;
    Ok(())
}

#[command]
pub fn add_custom_shortcut(shortcut: SearchItem) -> Result<(), String> {
    let mut data = get_global_search_data()?;
    
    // Remove existing shortcut with same id if it exists
    data.custom_shortcuts.retain(|s| s.id != shortcut.id);
    
    // Add new shortcut
    data.custom_shortcuts.push(shortcut);
    
    save_global_search_data(data)?;
    Ok(())
}

#[command]
pub fn remove_custom_shortcut(shortcut_id: String) -> Result<(), String> {
    let mut data = get_global_search_data()?;
    data.custom_shortcuts.retain(|s| s.id != shortcut_id);
    save_global_search_data(data)?;
    Ok(())
}

#[command]
pub fn update_search_preferences(preferences: SearchPreferences) -> Result<(), String> {
    let mut data = get_global_search_data()?;
    data.search_preferences = preferences;
    save_global_search_data(data)?;
    Ok(())
}

#[command]
pub fn get_search_analytics() -> Result<SearchStats, String> {
    let data = get_global_search_data()?;
    Ok(data.search_stats)
}

#[command]
pub fn increment_search_usage(item_id: String, category: String) -> Result<(), String> {
    let mut data = get_global_search_data()?;
    
    // Update search stats
    data.search_stats.total_searches += 1;
    data.search_stats.last_search_time = Some(chrono::Utc::now().to_rfc3339());
    
    // Update most used categories
    if !data.search_stats.most_used_categories.contains(&category) {
        data.search_stats.most_used_categories.push(category);
    }
    
    // Update recent items usage
    if let Some(item) = data.recent_items.iter_mut().find(|i| i.id == item_id) {
        item.use_count = Some(item.use_count.unwrap_or(0) + 1);
        item.last_used = Some(chrono::Utc::now().to_rfc3339());
    }
    
    save_global_search_data(data)?;
    Ok(())
}

#[command]
pub fn export_search_data() -> Result<String, String> {
    let data = get_global_search_data()?;
    serde_json::to_string_pretty(&data).map_err(|e| e.to_string())
}

#[command]
pub fn import_search_data(json_data: String) -> Result<(), String> {
    let data: GlobalSearchData = serde_json::from_str(&json_data)
        .map_err(|e| format!("Invalid JSON format: {}", e))?;
    
    save_global_search_data(data)?;
    Ok(())
}

#[command]
pub fn reset_search_data() -> Result<(), String> {
    let default_data = GlobalSearchData::default();
    save_global_search_data(default_data)?;
    Ok(())
} 