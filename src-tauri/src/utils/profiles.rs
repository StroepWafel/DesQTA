use crate::logger;
use ring::digest;
use serde::{Deserialize, Serialize};
use std::fs;
use std::io::{self, Read};
use std::path::PathBuf;

/// Profile represents a unique SEQTA account + instance combination
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Profile {
    pub id: String,
    pub base_url: String,
    pub user_id: i32,
    pub display_name: Option<String>,
    pub created_at: i64,
}

/// Profiles metadata stored at root level
#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct ProfilesMetadata {
    pub profiles: Vec<Profile>,
    pub current_profile_id: Option<String>,
    pub migration_completed: bool,
}

/// Get the base data directory (DesQTA root).
/// Public for app-level storage (e.g. reserved DesQTA client ID).
pub fn get_base_data_dir() -> PathBuf {
    #[cfg(target_os = "android")]
    {
        let mut dir = PathBuf::from("/data/data/com.desqta.app/files");
        dir.push("DesQTA");
        if !dir.exists() {
            fs::create_dir_all(&dir).expect("Unable to create data dir");
        }
        dir
    }
    #[cfg(not(target_os = "android"))]
    {
        let mut dir = dirs_next::data_dir().expect("Unable to determine data dir");
        dir.push("DesQTA");
        if !dir.exists() {
            fs::create_dir_all(&dir).expect("Unable to create data dir");
        }
        dir
    }
}

/// Get the profiles.json file path
fn profiles_metadata_file() -> PathBuf {
    let mut dir = get_base_data_dir();
    dir.push("profiles.json");
    dir
}

/// Get the profiles directory
fn profiles_dir() -> PathBuf {
    let mut dir = get_base_data_dir();
    dir.push("profiles");
    if !dir.exists() {
        fs::create_dir_all(&dir).expect("Unable to create profiles dir");
    }
    dir
}

/// Generate a profile ID from base_url and user_id
pub fn generate_profile_id(base_url: &str, user_id: i32) -> String {
    // Normalize base_url: remove trailing slashes, convert to lowercase
    let normalized_url = base_url.trim_end_matches('/').to_lowercase();
    let input = format!("{}:{}", normalized_url, user_id);
    
    // Use SHA-256 hash from ring
    let hash = digest::digest(&digest::SHA256, input.as_bytes());
    let hash_bytes = hash.as_ref();
    
    // Use first 16 bytes and encode as hex string (32 chars)
    hash_bytes[..16]
        .iter()
        .map(|b| format!("{:02x}", b))
        .collect::<String>()
}

/// Load profiles metadata from disk
fn load_profiles_metadata() -> ProfilesMetadata {
    let path = profiles_metadata_file();
    if let Ok(mut file) = fs::File::open(&path) {
        let mut contents = String::new();
        if file.read_to_string(&mut contents).is_ok() {
            if let Ok(metadata) = serde_json::from_str::<ProfilesMetadata>(&contents) {
                return metadata;
            }
        }
    }
    ProfilesMetadata::default()
}

/// Save profiles metadata to disk
fn save_profiles_metadata(metadata: &ProfilesMetadata) -> io::Result<()> {
    let path = profiles_metadata_file();
    fs::write(path, serde_json::to_string(metadata).unwrap())
}

/// Get the directory path for a specific profile
pub fn get_profile_dir(profile_id: &str) -> PathBuf {
    let mut dir = profiles_dir();
    dir.push(profile_id);
    if !dir.exists() {
        fs::create_dir_all(&dir).expect("Unable to create profile dir");
    }
    dir
}

/// ProfileManager handles profile operations
pub struct ProfileManager;

impl ProfileManager {
    /// Get or create a profile for the given base_url and user_info
    pub fn get_or_create_profile(base_url: String, user_id: i32, display_name: Option<String>) -> Result<Profile, String> {
        let profile_id = generate_profile_id(&base_url, user_id);
        let mut metadata = load_profiles_metadata();
        
        // Check if profile already exists
        if let Some(existing_profile) = metadata.profiles.iter().find(|p| p.id == profile_id) {
            if let Some(logger) = logger::get_logger() {
                let _ = logger.log(
                    logger::LogLevel::DEBUG,
                    "profiles",
                    "get_or_create_profile",
                    "Found existing profile",
                    serde_json::json!({"profile_id": profile_id}),
                );
            }
            return Ok(existing_profile.clone());
        }
        
        // Create new profile
        let profile = Profile {
            id: profile_id.clone(),
            base_url: base_url.clone(),
            user_id,
            display_name: display_name.clone(),
            created_at: chrono::Utc::now().timestamp(),
        };
        
        // Add to metadata
        metadata.profiles.push(profile.clone());
        
        // Set as current profile if none is set
        if metadata.current_profile_id.is_none() {
            metadata.current_profile_id = Some(profile_id.clone());
        }
        
        // Save metadata
        save_profiles_metadata(&metadata).map_err(|e| format!("Failed to save profiles metadata: {}", e))?;
        
        // Create profile directory
        let profile_dir = get_profile_dir(&profile_id);
        if !profile_dir.exists() {
            fs::create_dir_all(&profile_dir).map_err(|e| format!("Failed to create profile directory: {}", e))?;
        }
        
        if let Some(logger) = logger::get_logger() {
            let _ = logger.log(
                logger::LogLevel::INFO,
                "profiles",
                "get_or_create_profile",
                "Created new profile",
                serde_json::json!({"profile_id": profile_id, "base_url": base_url, "user_id": user_id}),
            );
        }
        
        Ok(profile)
    }
    
    /// Get the current active profile
    pub fn get_current_profile() -> Option<Profile> {
        let metadata = load_profiles_metadata();
        let current_id = metadata.current_profile_id?;
        
        metadata.profiles.iter().find(|p| p.id == current_id).cloned()
    }
    
    /// Set the current active profile
    pub fn set_current_profile(profile_id: String) -> Result<(), String> {
        let mut metadata = load_profiles_metadata();
        
        // Verify profile exists
        if !metadata.profiles.iter().any(|p| p.id == profile_id) {
            return Err(format!("Profile {} not found", profile_id));
        }
        
        metadata.current_profile_id = Some(profile_id.clone());
        save_profiles_metadata(&metadata).map_err(|e| format!("Failed to save profiles metadata: {}", e))?;
        
        if let Some(logger) = logger::get_logger() {
            let _ = logger.log(
                logger::LogLevel::INFO,
                "profiles",
                "set_current_profile",
                "Switched to profile",
                serde_json::json!({"profile_id": profile_id}),
            );
        }
        
        Ok(())
    }
    
    /// List all profiles
    pub fn list_profiles() -> Vec<Profile> {
        let metadata = load_profiles_metadata();
        metadata.profiles
    }
    
    /// Delete a profile (and its directory)
    pub fn delete_profile(profile_id: String) -> Result<(), String> {
        let mut metadata = load_profiles_metadata();
        
        // Remove from list
        metadata.profiles.retain(|p| p.id != profile_id);
        
        // If this was the current profile, clear it
        if metadata.current_profile_id.as_ref() == Some(&profile_id) {
            metadata.current_profile_id = None;
        }
        
        // Save metadata
        save_profiles_metadata(&metadata).map_err(|e| format!("Failed to save profiles metadata: {}", e))?;
        
        // Delete profile directory
        let profile_dir = get_profile_dir(&profile_id);
        if profile_dir.exists() {
            fs::remove_dir_all(&profile_dir).map_err(|e| format!("Failed to delete profile directory: {}", e))?;
        }
        
        if let Some(logger) = logger::get_logger() {
            let _ = logger.log(
                logger::LogLevel::INFO,
                "profiles",
                "delete_profile",
                "Deleted profile",
                serde_json::json!({"profile_id": profile_id}),
            );
        }
        
        Ok(())
    }
    
    /// Check if migration has been completed
    pub fn is_migration_completed() -> bool {
        let metadata = load_profiles_metadata();
        metadata.migration_completed
    }
    
    /// Mark migration as completed
    pub fn mark_migration_completed() -> Result<(), String> {
        let mut metadata = load_profiles_metadata();
        metadata.migration_completed = true;
        save_profiles_metadata(&metadata).map_err(|e| format!("Failed to save profiles metadata: {}", e))?;
        Ok(())
    }
}

#[tauri::command]
pub fn get_current_profile() -> Option<Profile> {
    ProfileManager::get_current_profile()
}

#[tauri::command]
pub fn list_profiles() -> Vec<Profile> {
    ProfileManager::list_profiles()
}

#[tauri::command]
pub fn switch_profile(profile_id: String, app: tauri::AppHandle) -> Result<(), String> {
    ProfileManager::set_current_profile(profile_id.clone())?;
    
    // Reinitialize database for new profile
    crate::database::reinit_database(&app)
        .map_err(|e| format!("Failed to reinitialize database: {}", e))?;
    
    if let Some(logger) = logger::get_logger() {
        let _ = logger.log(
            logger::LogLevel::INFO,
            "profiles",
            "switch_profile",
            "Switched profile and reinitialized database",
            serde_json::json!({"profile_id": profile_id}),
        );
    }
    
    Ok(())
}

#[tauri::command]
pub fn delete_profile(profile_id: String) -> Result<(), String> {
    ProfileManager::delete_profile(profile_id)
}

