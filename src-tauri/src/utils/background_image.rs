use base64::{engine::general_purpose, Engine as _};
use std::fs;
use std::path::{Path, PathBuf};

fn get_background_dir() -> Result<PathBuf, String> {
    let app_data_dir = dirs_next::data_dir().ok_or("Failed to get app data directory")?;
    let background_dir = app_data_dir.join("DesQTA").join("background");

    if !background_dir.exists() {
        fs::create_dir_all(&background_dir)
            .map_err(|e| format!("Failed to create background directory: {}", e))?;
    }

    Ok(background_dir)
}

fn detect_extension(base64_data: &str, bytes: &[u8]) -> &'static str {
    let lower = base64_data.to_ascii_lowercase();
    if lower.contains("image/jpeg") || lower.contains("image/jpg") {
        return "jpg";
    }
    if lower.contains("image/webp") {
        return "webp";
    }
    if lower.contains("image/gif") {
        return "gif";
    }
    if lower.contains("image/png") {
        return "png";
    }
    if bytes.len() >= 3 && bytes[0] == 0xFF && bytes[1] == 0xD8 && bytes[2] == 0xFF {
        return "jpg";
    }
    if bytes.len() >= 4 && bytes.starts_with(b"\x89PNG") {
        return "png";
    }
    if bytes.len() >= 12 && bytes.starts_with(b"RIFF") && &bytes[8..12] == b"WEBP" {
        return "webp";
    }
    if bytes.len() >= 6 && (bytes.starts_with(b"GIF87a") || bytes.starts_with(b"GIF89a")) {
        return "gif";
    }
    "png"
}

fn mime_for_extension(ext: &str) -> &'static str {
    match ext {
        "jpg" | "jpeg" => "image/jpeg",
        "webp" => "image/webp",
        "gif" => "image/gif",
        _ => "image/png",
    }
}

fn clear_existing_background_files(dir: &Path) -> Result<(), String> {
    if !dir.exists() {
        return Ok(());
    }

    for entry in fs::read_dir(dir).map_err(|e| format!("Failed to read background directory: {}", e))? {
        let entry = entry.map_err(|e| format!("Failed to read directory entry: {}", e))?;
        let path = entry.path();
        if path.is_file() {
            let name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");
            if name.starts_with("custom_background.") {
                fs::remove_file(&path)
                    .map_err(|e| format!("Failed to remove old background file: {}", e))?;
            }
        }
    }

    Ok(())
}

fn find_background_file() -> Result<Option<PathBuf>, String> {
    let dir = get_background_dir()?;
    if !dir.exists() {
        return Ok(None);
    }

    for entry in fs::read_dir(&dir).map_err(|e| format!("Failed to read background directory: {}", e))? {
        let entry = entry.map_err(|e| format!("Failed to read directory entry: {}", e))?;
        let path = entry.path();
        if path.is_file() {
            let name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");
            if name.starts_with("custom_background.") {
                return Ok(Some(path));
            }
        }
    }

    Ok(None)
}

/// Save a base64-encoded image as the app's custom background (stored under app data dir).
#[tauri::command]
pub async fn save_background_image(base64_data: String) -> Result<String, String> {
    let base64_clean = if base64_data.contains(',') {
        base64_data.split(',').nth(1).unwrap_or(&base64_data)
    } else {
        &base64_data
    };

    let image_data = general_purpose::STANDARD
        .decode(base64_clean)
        .map_err(|e| format!("Failed to decode base64 image: {}", e))?;

    if image_data.is_empty() {
        return Err("Image data is empty".to_string());
    }

    const MAX_BYTES: usize = 15 * 1024 * 1024;
    if image_data.len() > MAX_BYTES {
        return Err("Image is too large (max 15MB)".to_string());
    }

    let ext = detect_extension(&base64_data, &image_data);
    let dir = get_background_dir()?;
    clear_existing_background_files(&dir)?;

    let file_path = dir.join(format!("custom_background.{ext}"));
    fs::write(&file_path, image_data)
        .map_err(|e| format!("Failed to save background image: {}", e))?;

    file_path
        .to_str()
        .ok_or("Failed to convert path to string".to_string())
        .map(|s| s.to_string())
}

#[tauri::command]
pub async fn get_background_image_path_cmd() -> Result<Option<String>, String> {
    let path = find_background_file()?;
    Ok(path.and_then(|p| p.to_str().map(|s| s.to_string())))
}

#[tauri::command]
pub async fn delete_background_image() -> Result<(), String> {
    let dir = get_background_dir()?;
    clear_existing_background_files(&dir)
}

#[tauri::command]
pub async fn has_custom_background_image() -> Result<bool, String> {
    Ok(find_background_file()?.is_some())
}

#[tauri::command]
pub async fn get_background_image_data_url() -> Result<Option<String>, String> {
    let path = match find_background_file()? {
        Some(path) => path,
        None => return Ok(None),
    };

    let image_data =
        fs::read(&path).map_err(|e| format!("Failed to read background image: {}", e))?;

    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("png");
    let mime = mime_for_extension(ext);
    let base64_data = general_purpose::STANDARD.encode(&image_data);
    Ok(Some(format!("data:{mime};base64,{base64_data}")))
}
