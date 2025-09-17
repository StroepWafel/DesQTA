use std::path::PathBuf;
use std::fs;
use tauri::AppHandle;
use base64::{Engine as _, engine::general_purpose};

/// Get the profile picture directory path
fn get_profile_picture_dir() -> Result<PathBuf, String> {
    let app_data_dir = dirs_next::data_dir()
        .ok_or("Failed to get app data directory")?;
    
    let profile_dir = app_data_dir.join("DesQTA").join("profile");
    
    // Create directory if it doesn't exist
    if !profile_dir.exists() {
        fs::create_dir_all(&profile_dir)
            .map_err(|e| format!("Failed to create profile directory: {}", e))?;
    }
    
    Ok(profile_dir)
}

/// Get the path where the custom profile picture should be stored
fn get_profile_picture_path() -> Result<PathBuf, String> {
    let profile_dir = get_profile_picture_dir()?;
    Ok(profile_dir.join("profile_picture.png"))
}

/// Save a base64 encoded image as the user's profile picture
#[tauri::command]
pub async fn save_profile_picture(base64_data: String) -> Result<String, String> {
    // Remove data URL prefix if present (e.g., "data:image/png;base64,")
    let base64_clean = if base64_data.contains(',') {
        base64_data.split(',').nth(1).unwrap_or(&base64_data)
    } else {
        &base64_data
    };
    
    // Decode base64 data
    let image_data = general_purpose::STANDARD
        .decode(base64_clean)
        .map_err(|e| format!("Failed to decode base64 image: {}", e))?;
    
    // Get the profile picture path
    let profile_path = get_profile_picture_path()?;
    
    // Save the image data to file
    fs::write(&profile_path, image_data)
        .map_err(|e| format!("Failed to save profile picture: {}", e))?;
    
    // Return the file path as a string
    profile_path
        .to_str()
        .ok_or("Failed to convert path to string".to_string())
        .map(|s| s.to_string())
}

/// Get the path to the user's custom profile picture if it exists
#[tauri::command]
pub async fn get_profile_picture_path_cmd() -> Result<Option<String>, String> {
    let profile_path = get_profile_picture_path()?;
    
    if profile_path.exists() {
        Ok(Some(
            profile_path
                .to_str()
                .ok_or("Failed to convert path to string")?
                .to_string()
        ))
    } else {
        Ok(None)
    }
}

/// Delete the user's custom profile picture
#[tauri::command]
pub async fn delete_profile_picture() -> Result<(), String> {
    let profile_path = get_profile_picture_path()?;
    
    if profile_path.exists() {
        fs::remove_file(profile_path)
            .map_err(|e| format!("Failed to delete profile picture: {}", e))?;
    }
    
    Ok(())
}

/// Check if a custom profile picture exists
#[tauri::command]
pub async fn has_custom_profile_picture() -> Result<bool, String> {
    let profile_path = get_profile_picture_path()?;
    Ok(profile_path.exists())
}

/// Get profile picture as base64 data URL for web display
#[tauri::command]
pub async fn get_profile_picture_data_url() -> Result<Option<String>, String> {
    let profile_path = get_profile_picture_path()?;
    
    if !profile_path.exists() {
        return Ok(None);
    }
    
    // Read the image file
    let image_data = fs::read(profile_path)
        .map_err(|e| format!("Failed to read profile picture: {}", e))?;
    
    // Convert to base64
    let base64_data = general_purpose::STANDARD.encode(&image_data);
    
    // Create data URL (assuming PNG format)
    let data_url = format!("data:image/png;base64,{}", base64_data);
    
    Ok(Some(data_url))
}
