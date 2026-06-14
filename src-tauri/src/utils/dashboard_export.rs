use serde::{Deserialize, Serialize};
use std::fs;
use std::io::{Read, Write};
use std::path::Path;
use zip::write::FileOptions;
use zip::{ZipArchive, ZipWriter, CompressionMethod};

const DASHBOARD_ZIP_ENTRY: &str = "dashboard.json";

#[derive(Debug, Serialize, Deserialize)]
pub struct DashboardExportPayload {
    pub format: String,
    pub format_version: u32,
    pub exported_at: String,
    pub exported_by: String,
    pub name: String,
    pub description: Option<String>,
    pub layout: serde_json::Value,
}

#[tauri::command]
pub async fn export_dashboard_dqdash(
    file_path: String,
    payload: DashboardExportPayload,
) -> Result<(), String> {
    let json =
        serde_json::to_string(&payload).map_err(|e| format!("Failed to serialize dashboard: {}", e))?;

    let file = fs::File::create(&file_path).map_err(|e| format!("Failed to create file: {}", e))?;
    let mut zip = ZipWriter::new(file);
    let options = FileOptions::default().compression_method(CompressionMethod::Deflated);

    zip.start_file(DASHBOARD_ZIP_ENTRY, options)
        .map_err(|e| format!("Failed to start zip entry: {}", e))?;
    zip.write_all(json.as_bytes())
        .map_err(|e| format!("Failed to write zip entry: {}", e))?;
    zip.finish()
        .map_err(|e| format!("Failed to finalize zip: {}", e))?;

    Ok(())
}

#[tauri::command]
pub async fn import_dashboard_dqdash(file_path: String) -> Result<DashboardExportPayload, String> {
    read_dqdash_payload(&file_path)
}

fn read_dqdash_payload(file_path: &str) -> Result<DashboardExportPayload, String> {
    let file = fs::File::open(file_path).map_err(|e| format!("Failed to open file: {}", e))?;
    let mut archive =
        ZipArchive::new(file).map_err(|e| format!("Invalid .DQDash archive: {}", e))?;

    let mut entry = archive
        .by_name(DASHBOARD_ZIP_ENTRY)
        .map_err(|_| "Invalid .DQDash file: missing dashboard.json".to_string())?;
    let mut contents = String::new();
    entry
        .read_to_string(&mut contents)
        .map_err(|e| format!("Failed to read dashboard.json: {}", e))?;

    serde_json::from_str(&contents).map_err(|e| format!("Invalid dashboard JSON: {}", e))
}

fn json_path_beside_dqdash(file_path: &str) -> Result<String, String> {
    let path = Path::new(file_path);
    let parent = path
        .parent()
        .ok_or_else(|| "Invalid file path: no parent directory".to_string())?;
    let stem = path
        .file_stem()
        .and_then(|s| s.to_str())
        .ok_or_else(|| "Invalid file path: missing file name".to_string())?;
    Ok(parent
        .join(format!("{}.json", stem))
        .to_string_lossy()
        .into_owned())
}

/// Dev helper: read a `.DQDash` zip and write pretty JSON next to it (same name, `.json` ext).
#[tauri::command]
pub async fn extract_dqdash_to_json(file_path: String) -> Result<String, String> {
    let payload = read_dqdash_payload(&file_path)?;
    let output_path = json_path_beside_dqdash(&file_path)?;
    let pretty = serde_json::to_string_pretty(&payload)
        .map_err(|e| format!("Failed to serialize JSON: {}", e))?;
    fs::write(&output_path, pretty).map_err(|e| format!("Failed to write JSON file: {}", e))?;
    Ok(output_path)
}
