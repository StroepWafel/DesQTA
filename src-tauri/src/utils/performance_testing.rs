use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PerformanceMetrics {
    #[serde(rename = "pageName")]
    pub page_name: String,
    pub path: String,
    #[serde(rename = "loadTime")]
    pub load_time: f64,
    #[serde(rename = "domContentLoaded")]
    pub dom_content_loaded: f64,
    #[serde(rename = "firstPaint")]
    pub first_paint: Option<f64>,
    #[serde(rename = "firstContentfulPaint")]
    pub first_contentful_paint: Option<f64>,
    #[serde(rename = "largestContentfulPaint")]
    pub largest_contentful_paint: Option<f64>,
    #[serde(rename = "cumulativeLayoutShift")]
    pub cumulative_layout_shift: Option<f64>,
    #[serde(rename = "firstInputDelay")]
    pub first_input_delay: Option<f64>,
    #[serde(rename = "memoryUsage")]
    pub memory_usage: Option<f64>,
    pub errors: Vec<String>,
    pub warnings: Vec<String>,
    #[serde(rename = "networkRequests")]
    pub network_requests: u32,
    #[serde(rename = "resourceLoadTimes")]
    pub resource_load_times: Vec<ResourceLoadTime>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ResourceLoadTime {
    pub name: String,
    pub duration: f64,
    pub size: Option<u32>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TestSummary {
    #[serde(rename = "averageLoadTime")]
    pub average_load_time: f64,
    #[serde(rename = "slowestPage")]
    pub slowest_page: PageSummary,
    #[serde(rename = "fastestPage")]
    pub fastest_page: PageSummary,
    #[serde(rename = "totalErrors")]
    pub total_errors: u32,
    #[serde(rename = "totalWarnings")]
    pub total_warnings: u32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PageSummary {
    pub name: String,
    pub time: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TestResults {
    #[serde(rename = "startTime")]
    pub start_time: u64,
    #[serde(rename = "endTime")]
    pub end_time: u64,
    #[serde(rename = "totalDuration")]
    pub total_duration: u64,
    pub pages: Vec<PerformanceMetrics>,
    #[serde(rename = "overallErrors")]
    pub overall_errors: Vec<String>,
    pub summary: TestSummary,
    pub timestamp: String,
    pub version: String,
}

fn get_performance_tests_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data directory: {}", e))?;

    let performance_dir = app_data_dir.join("performance-tests");

    // Create directory if it doesn't exist
    if !performance_dir.exists() {
        fs::create_dir_all(&performance_dir)
            .map_err(|e| format!("Failed to create performance tests directory: {}", e))?;
    }

    Ok(performance_dir)
}

#[tauri::command]
pub fn save_performance_test_results(
    app: AppHandle,
    results: TestResults,
) -> Result<String, String> {
    println!(
        "[DesQTA] Saving performance test results with {} pages",
        results.pages.len()
    );

    let performance_dir = get_performance_tests_dir(&app)?;

    // Generate filename with timestamp
    let timestamp = chrono::Utc::now().format("%Y-%m-%d_%H-%M-%S").to_string();
    let filename = format!("performance-test-{}.json", timestamp);
    let file_path = performance_dir.join(&filename);

    // Add metadata to results
    let mut results_with_metadata = results;
    results_with_metadata.timestamp = timestamp.clone();
    results_with_metadata.version = env!("CARGO_PKG_VERSION").to_string();

    // Serialize and save to file
    let json_content = serde_json::to_string_pretty(&results_with_metadata)
        .map_err(|e| format!("Failed to serialize results: {}", e))?;

    fs::write(&file_path, json_content)
        .map_err(|e| format!("Failed to write performance test file: {}", e))?;

    let file_path_str = file_path.to_string_lossy().to_string();
    println!(
        "[DesQTA] Performance test results saved to: {}",
        file_path_str
    );

    Ok(file_path_str)
}

#[tauri::command]
pub fn get_performance_test_results(app: AppHandle) -> Result<Vec<String>, String> {
    let performance_dir = get_performance_tests_dir(&app)?;

    let mut results = Vec::new();

    if performance_dir.exists() {
        let entries = fs::read_dir(&performance_dir)
            .map_err(|e| format!("Failed to read performance tests directory: {}", e))?;

        for entry in entries {
            let entry = entry.map_err(|e| format!("Failed to read directory entry: {}", e))?;
            let path = entry.path();

            if path.is_file() && path.extension().map_or(false, |ext| ext == "json") {
                if let Some(filename) = path.file_name().and_then(|n| n.to_str()) {
                    results.push(filename.to_string());
                }
            }
        }
    }

    // Sort by filename (which includes timestamp)
    results.sort();
    results.reverse(); // Most recent first

    Ok(results)
}

#[tauri::command]
pub fn load_performance_test_result(
    app: AppHandle,
    filename: String,
) -> Result<TestResults, String> {
    let performance_dir = get_performance_tests_dir(&app)?;
    let file_path = performance_dir.join(&filename);

    if !file_path.exists() {
        return Err(format!("Performance test file not found: {}", filename));
    }

    let content = fs::read_to_string(&file_path)
        .map_err(|e| format!("Failed to read performance test file: {}", e))?;

    let results: TestResults = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse performance test results: {}", e))?;

    Ok(results)
}

#[tauri::command]
pub fn delete_performance_test_result(app: AppHandle, filename: String) -> Result<(), String> {
    let performance_dir = get_performance_tests_dir(&app)?;
    let file_path = performance_dir.join(&filename);

    if !file_path.exists() {
        return Err(format!("Performance test file not found: {}", filename));
    }

    fs::remove_file(&file_path)
        .map_err(|e| format!("Failed to delete performance test file: {}", e))?;

    println!("[DesQTA] Deleted performance test file: {}", filename);

    Ok(())
}

#[tauri::command]
pub fn get_performance_tests_directory(app: AppHandle) -> Result<String, String> {
    let performance_dir = get_performance_tests_dir(&app)?;
    Ok(performance_dir.to_string_lossy().to_string())
}

#[tauri::command]
pub fn clear_all_performance_tests(app: AppHandle) -> Result<u32, String> {
    let performance_dir = get_performance_tests_dir(&app)?;

    if !performance_dir.exists() {
        return Ok(0);
    }

    let entries = fs::read_dir(&performance_dir)
        .map_err(|e| format!("Failed to read performance tests directory: {}", e))?;

    let mut deleted_count = 0;

    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read directory entry: {}", e))?;
        let path = entry.path();

        if path.is_file() && path.extension().map_or(false, |ext| ext == "json") {
            fs::remove_file(&path).map_err(|e| format!("Failed to delete file: {}", e))?;
            deleted_count += 1;
        }
    }

    println!("[DesQTA] Cleared {} performance test files", deleted_count);

    Ok(deleted_count)
}
