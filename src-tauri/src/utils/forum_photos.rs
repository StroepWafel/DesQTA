use crate::logger;
use crate::profiles;
use base64::{engine::general_purpose, Engine as _};
use rusqlite::params;
use std::fs;
use std::path::PathBuf;
use anyhow::Result;

/// Get the photos directory path for the current profile
fn get_photos_directory() -> Result<PathBuf, String> {
    let profile = profiles::ProfileManager::get_current_profile()
        .ok_or_else(|| "No active profile. Please log in first.".to_string())?;
    
    let mut dir = profiles::get_profile_dir(&profile.id);
    dir.push("photos");
    
    if !dir.exists() {
        fs::create_dir_all(&dir)
            .map_err(|e| format!("Failed to create photos directory: {}", e))?;
    }
    
    Ok(dir)
}

/// Save a photo from base64 data to the profile photos directory
#[tauri::command]
pub async fn save_forum_photo(uuid: String, base64_data: String, name: Option<String>) -> Result<String, String> {
    // Remove data URL prefix if present
    let base64_clean = if base64_data.contains(',') {
        base64_data.split(',').nth(1).unwrap_or(&base64_data)
    } else {
        &base64_data
    };

    // Decode base64 data
    let image_data = general_purpose::STANDARD
        .decode(base64_clean)
        .map_err(|e| format!("Failed to decode base64 image: {}", e))?;

    // Get photos directory
    let photos_dir = get_photos_directory()?;
    let photo_path = photos_dir.join(format!("{}.png", uuid));

    // Save the image data to file
    fs::write(&photo_path, image_data)
        .map_err(|e| format!("Failed to save photo: {}", e))?;

    // Cache in database
    if let Err(e) = cache_photo_path(&uuid, &photo_path.to_string_lossy(), name.as_deref()) {
        if let Some(logger) = logger::get_logger() {
            let _ = logger.log(
                logger::LogLevel::WARN,
                "forum_photos",
                "save_forum_photo",
                &format!("Failed to cache photo path: {}", e),
                serde_json::json!({"uuid": uuid}),
            );
        }
    }

    Ok(photo_path.to_string_lossy().to_string())
}

/// Get the path to a cached photo if it exists
#[tauri::command]
pub async fn get_forum_photo_path(uuid: String) -> Result<Option<String>, String> {
    // Check database cache first
    if let Ok(Some(path)) = get_cached_photo_path(&uuid) {
        // Verify file still exists
        if PathBuf::from(&path).exists() {
            return Ok(Some(path));
        } else {
            // File doesn't exist, remove from cache
            remove_cached_photo_path(&uuid)?;
        }
    }
    
    // Check filesystem directly
    let photos_dir = get_photos_directory()?;
    let photo_path = photos_dir.join(format!("{}.png", uuid));
    
    if photo_path.exists() {
        let path_str = photo_path.to_string_lossy().to_string();
        // Cache it in database (without name since we don't have it here)
        let _ = cache_photo_path(&uuid, &path_str, None);
        return Ok(Some(path_str));
    }
    
    Ok(None)
}

/// Get UUID by name (for directory matching)
/// Supports exact match and case-insensitive matching
#[tauri::command]
pub async fn get_forum_photo_uuid_by_name(name: String) -> Result<Option<String>, String> {
    use crate::database;
    
    database::with_conn(|conn| {
        // Try exact match first
        let mut stmt = conn
            .prepare("SELECT uuid FROM forum_photos WHERE name = ?1 LIMIT 1")
            .map_err(|e| anyhow::anyhow!("Failed to prepare statement: {}", e))?;
        
        let uuid: Result<String, rusqlite::Error> = stmt.query_row(params![name], |row| {
            Ok(row.get(0)?)
        });
        
        match uuid {
            Ok(u) => return Ok(Some(u)),
            Err(rusqlite::Error::QueryReturnedNoRows) => {
                // Try case-insensitive match
                let mut stmt_ci = conn
                    .prepare("SELECT uuid FROM forum_photos WHERE LOWER(name) = LOWER(?1) LIMIT 1")
                    .map_err(|e| anyhow::anyhow!("Failed to prepare case-insensitive statement: {}", e))?;
                
                let uuid_ci: Result<String, rusqlite::Error> = stmt_ci.query_row(params![name], |row| {
                    Ok(row.get(0)?)
                });
                
                match uuid_ci {
                    Ok(u) => Ok(Some(u)),
                    Err(rusqlite::Error::QueryReturnedNoRows) => {
                        // Try partial match (name contains the search term, ignoring case)
                        // This helps match "Reuben Wheeler" with stored "Reuben Wheeler" even if stored name has title
                        let search_lower = name.to_lowercase();
                        let mut stmt_partial = conn
                            .prepare("SELECT uuid FROM forum_photos WHERE LOWER(name) LIKE ?1 LIMIT 1")
                            .map_err(|e| anyhow::anyhow!("Failed to prepare partial match statement: {}", e))?;
                        
                        // Match if stored name contains the search name
                        let pattern = format!("%{}%", search_lower);
                        let uuid_partial: Result<String, rusqlite::Error> = stmt_partial.query_row(params![pattern], |row| {
                            Ok(row.get(0)?)
                        });
                        
                        match uuid_partial {
                            Ok(u) => Ok(Some(u)),
                            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
                            Err(e) => Err(anyhow::anyhow!("Failed to get UUID by name (partial match): {}", e)),
                        }
                    },
                    Err(e) => Err(anyhow::anyhow!("Failed to get UUID by name (case-insensitive): {}", e)),
                }
            },
            Err(e) => Err(anyhow::anyhow!("Failed to get UUID by name: {}", e)),
        }
    })
    .map_err(|e| e.to_string())
}

/// Get photo as base64 data URL for web display
#[tauri::command]
pub async fn get_forum_photo_data_url(uuid: String) -> Result<Option<String>, String> {
    let photo_path = get_forum_photo_path(uuid).await?;
    
    if let Some(path) = photo_path {
        if !PathBuf::from(&path).exists() {
            return Ok(None);
        }

        // Read the image file
        let image_data = fs::read(&path)
            .map_err(|e| format!("Failed to read photo: {}", e))?;

        // Convert to base64
        let base64_data = general_purpose::STANDARD.encode(&image_data);

        // Create data URL (assuming PNG format)
        let data_url = format!("data:image/png;base64,{}", base64_data);

        Ok(Some(data_url))
    } else {
        Ok(None)
    }
}

/// Cache photo path in database
fn cache_photo_path(uuid: &str, path: &str, name: Option<&str>) -> Result<(), String> {
    use crate::database;
    
    database::with_conn(|conn| {
        conn.execute(
            "INSERT OR REPLACE INTO forum_photos (uuid, file_path, name, cached_at) VALUES (?1, ?2, ?3, ?4)",
            params![uuid, path, name, chrono::Utc::now().timestamp()],
        )
        .map_err(|e| anyhow::anyhow!("Failed to cache photo path: {}", e))?;
        Ok(())
    })
    .map_err(|e| e.to_string())
}

/// Get cached photo path from database
fn get_cached_photo_path(uuid: &str) -> Result<Option<String>, String> {
    use crate::database;
    
    database::with_conn(|conn| {
        let mut stmt = conn
            .prepare("SELECT file_path FROM forum_photos WHERE uuid = ?1")
            .map_err(|e| anyhow::anyhow!("Failed to prepare statement: {}", e))?;
        
        let path: Result<String, rusqlite::Error> = stmt.query_row(params![uuid], |row| {
            Ok(row.get(0)?)
        });
        
        match path {
            Ok(p) => Ok(Some(p)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(anyhow::anyhow!("Failed to get cached photo path: {}", e)),
        }
    })
    .map_err(|e| e.to_string())
}

/// Remove cached photo path from database
fn remove_cached_photo_path(uuid: &str) -> Result<(), String> {
    use crate::database;
    
    database::with_conn(|conn| {
        conn.execute(
            "DELETE FROM forum_photos WHERE uuid = ?1",
            params![uuid],
        )
        .map_err(|e| anyhow::anyhow!("Failed to remove cached photo path: {}", e))?;
        Ok(())
    })
    .map_err(|e| e.to_string())
}

/// Initialize forum_photos table in database schema
pub fn init_forum_photos_table(conn: &rusqlite::Connection) -> rusqlite::Result<()> {
    conn.execute(
        "CREATE TABLE IF NOT EXISTS forum_photos (
            uuid TEXT PRIMARY KEY,
            file_path TEXT NOT NULL,
            name TEXT,
            cached_at INTEGER NOT NULL
        )",
        [],
    )?;
    
    // Create index on cached_at for cleanup queries
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_forum_photos_cached_at ON forum_photos(cached_at)",
        [],
    )?;
    
    // Create index on name for directory lookups
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_forum_photos_name ON forum_photos(name)",
        [],
    )?;
    
    Ok(())
}
