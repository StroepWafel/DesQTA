use super::netgrab;
use super::netgrab::RequestMethod;
use crate::logger;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::{fs, path::PathBuf};

const STUDENT_ID: i32 = 69;

#[derive(Debug, Serialize, Deserialize, Clone)]
struct Subject {
    code: String,
    programme: i32,
    metaclass: i32,
    title: Option<String>,
    description: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct Folder {
    #[serde(default, deserialize_with = "deserialize_bool_from_int_or_bool")]
    active: bool,
    subjects: Vec<Subject>,
}

/// Helper to deserialize bool from either integer (1/0) or boolean
fn deserialize_bool_from_int_or_bool<'de, D>(deserializer: D) -> Result<bool, D::Error>
where
    D: serde::Deserializer<'de>,
{
    use serde::de::{self, Visitor};
    use std::fmt;

    struct BoolOrIntVisitor;

    impl<'de> Visitor<'de> for BoolOrIntVisitor {
        type Value = bool;

        fn expecting(&self, formatter: &mut fmt::Formatter) -> fmt::Result {
            formatter.write_str("a boolean or integer (0/1)")
        }

        fn visit_bool<E>(self, value: bool) -> Result<bool, E>
        where
            E: de::Error,
        {
            Ok(value)
        }

        fn visit_i64<E>(self, value: i64) -> Result<bool, E>
        where
            E: de::Error,
        {
            Ok(value != 0)
        }

        fn visit_u64<E>(self, value: u64) -> Result<bool, E>
        where
            E: de::Error,
        {
            Ok(value != 0)
        }
    }

    deserializer.deserialize_any(BoolOrIntVisitor)
}

fn analytics_file() -> PathBuf {
    #[cfg(target_os = "android")]
    {
        // On Android, use the app's internal storage directory
        let mut dir = PathBuf::from("/data/data/com.desqta.app/files");
        dir.push("DesQTA");
        if !dir.exists() {
            fs::create_dir_all(&dir).expect("Unable to create data dir");
        }
        dir.push("analytics.json");
        dir
    }
    #[cfg(not(target_os = "android"))]
    {
        let mut dir = dirs_next::data_dir().expect("Unable to determine data dir");
        dir.push("DesQTA");
        if !dir.exists() {
            fs::create_dir_all(&dir).expect("Unable to create data dir");
        }
        dir.push("analytics.json");
        dir
    }
}

#[tauri::command]
pub fn save_analytics(data: String) -> Result<(), String> {
    let path = analytics_file();
    fs::write(path, data).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn load_analytics() -> Result<String, String> {
    let path = analytics_file();
    fs::read_to_string(path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_analytics() -> Result<(), String> {
    let path = analytics_file();
    if path.exists() {
        std::fs::remove_file(path).map_err(|e| e.to_string())
    } else {
        Ok(())
    }
}

/// Fetch subjects from SEQTA API
async fn fetch_subjects() -> Result<Vec<Folder>, String> {
    let body = json!({});

    let response = netgrab::fetch_api_data(
        &"/seqta/student/load/subjects?".to_string(),
        RequestMethod::POST,
        Some({
            let mut headers = HashMap::new();
            headers.insert(
                "Content-Type".to_string(),
                "application/json; charset=utf-8".to_string(),
            );
            headers
        }),
        Some(body),
        None,
        false,
        false,
    )
    .await?;

    let data: Value =
        serde_json::from_str(&response).map_err(|e| format!("Failed to parse subjects: {}", e))?;

    let folders: Vec<Folder> = serde_json::from_value(data["payload"].clone())
        .map_err(|e| format!("Failed to deserialize folders: {}", e))?;

    Ok(folders)
}

/// Fetch upcoming assessments from SEQTA API
async fn fetch_upcoming_assessments() -> Result<Vec<Value>, String> {
    let body = json!({
        "student": STUDENT_ID
    });

    let response = netgrab::fetch_api_data(
        &"/seqta/student/assessment/list/upcoming?".to_string(),
        RequestMethod::POST,
        Some({
            let mut headers = HashMap::new();
            headers.insert(
                "Content-Type".to_string(),
                "application/json; charset=utf-8".to_string(),
            );
            headers
        }),
        Some(body),
        None,
        false,
        false,
    )
    .await?;

    let data: Value = serde_json::from_str(&response)
        .map_err(|e| format!("Failed to parse upcoming assessments: {}", e))?;

    Ok(data["payload"].as_array().cloned().unwrap_or_default())
}

/// Fetch past assessments for a specific subject
async fn fetch_past_assessments(programme: i32, metaclass: i32) -> Result<Vec<Value>, String> {
    let body = json!({
        "programme": programme,
        "metaclass": metaclass,
        "student": STUDENT_ID
    });

    let response = netgrab::fetch_api_data(
        &"/seqta/student/assessment/list/past?".to_string(),
        RequestMethod::POST,
        Some({
            let mut headers = HashMap::new();
            headers.insert(
                "Content-Type".to_string(),
                "application/json; charset=utf-8".to_string(),
            );
            headers
        }),
        Some(body),
        None,
        false,
        false,
    )
    .await?;

    let data: Value = serde_json::from_str(&response)
        .map_err(|e| format!("Failed to parse past assessments: {}", e))?;

    // Check both pending and tasks arrays
    let mut result = Vec::new();

    if let Some(pending) = data["payload"]["pending"].as_array() {
        result.extend(pending.iter().cloned());
    }

    if let Some(tasks) = data["payload"]["tasks"].as_array() {
        result.extend(tasks.iter().cloned());
    }

    Ok(result)
}

/// Extract finalGrade from assessment data
fn extract_final_grade(assessment: &Value) -> Option<f32> {
    // Check if status is MARKS_RELEASED
    let status = assessment.get("status")?.as_str()?;
    if status != "MARKS_RELEASED" {
        return None;
    }

    // Try criteria[0].results.percentage first
    if let Some(criteria) = assessment.get("criteria").and_then(|c| c.as_array()) {
        if let Some(first_criterion) = criteria.get(0) {
            if let Some(results) = first_criterion.get("results") {
                if let Some(percentage) = results.get("percentage").and_then(|p| p.as_f64()) {
                    return Some(percentage as f32);
                }
            }
        }
    }

    // Fallback to results.percentage
    if let Some(results) = assessment.get("results") {
        if let Some(percentage) = results.get("percentage").and_then(|p| p.as_f64()) {
            return Some(percentage as f32);
        }
    }

    // Check if finalGrade is already set
    if let Some(final_grade) = assessment.get("finalGrade").and_then(|g| g.as_f64()) {
        return Some(final_grade as f32);
    }

    None
}

/// Extract letterGrade from assessment data
fn extract_letter_grade(assessment: &Value) -> Option<String> {
    // Check if status is MARKS_RELEASED
    let status = assessment.get("status")?.as_str()?;
    if status != "MARKS_RELEASED" {
        return None;
    }

    // Try criteria[0].results.grade first (matching assessment detail page)
    if let Some(criteria) = assessment.get("criteria").and_then(|c| c.as_array()) {
        if let Some(first_criterion) = criteria.get(0) {
            if let Some(results) = first_criterion.get("results") {
                if let Some(grade) = results.get("grade").and_then(|g| g.as_str()) {
                    return Some(grade.to_string());
                }
            }
        }
    }

    // Fallback to results.grade
    if let Some(results) = assessment.get("results") {
        if let Some(grade) = results.get("grade").and_then(|g| g.as_str()) {
            return Some(grade.to_string());
        }
    }

    // Check if letterGrade is already set
    if let Some(letter_grade) = assessment.get("letterGrade").and_then(|g| g.as_str()) {
        return Some(letter_grade.to_string());
    }

    None
}

/// Sync analytics data - fetches new assessments and merges with existing
#[tauri::command]
pub async fn sync_analytics_data() -> Result<String, String> {
    if let Some(logger) = logger::get_logger() {
        let _ = logger.log(
            logger::LogLevel::INFO,
            "analytics",
            "sync_analytics_data",
            "Starting analytics data sync",
            json!({}),
        );
    }

    // Load existing analytics data
    let path = analytics_file();
    let mut existing_assessments: Vec<Value> = Vec::new();
    if path.exists() {
        if let Ok(content) = fs::read_to_string(&path) {
            if let Ok(parsed) = serde_json::from_str::<Vec<Value>>(&content) {
                existing_assessments = parsed;
            } else if let Ok(parsed_obj) = serde_json::from_str::<Value>(&content) {
                // Handle case where it's an object instead of array
                if let Some(obj) = parsed_obj.as_object() {
                    existing_assessments = obj.values().cloned().collect();
                }
            }
        }
    }

    // Create a map of existing assessments by ID
    let mut existing_map: HashMap<i32, Value> = HashMap::new();
    for assessment in existing_assessments {
        if let Some(id) = assessment.get("id").and_then(|v| v.as_i64()) {
            existing_map.insert(id as i32, assessment);
        }
    }

    // Fetch subjects
    let folders = fetch_subjects().await?;

    // Extract all unique subjects
    let mut unique_subjects_map: HashMap<String, Subject> = HashMap::new();
    for folder in &folders {
        for subject in &folder.subjects {
            let key = format!("{}-{}", subject.programme, subject.metaclass);
            if !unique_subjects_map.contains_key(&key) {
                unique_subjects_map.insert(key, subject.clone());
            }
        }
    }

    // Fetch upcoming assessments
    let upcoming_assessments = fetch_upcoming_assessments().await?;

    // Fetch past assessments for all subjects in parallel
    let mut past_futures = Vec::new();
    for subject in unique_subjects_map.values() {
        past_futures.push(fetch_past_assessments(subject.programme, subject.metaclass));
    }

    let past_results = futures::future::join_all(past_futures).await;
    let past_assessments: Vec<Value> = past_results
        .into_iter()
        .filter_map(|r| r.ok())
        .flatten()
        .collect();

    // Combine all assessments
    let mut all_assessments = Vec::new();
    all_assessments.extend(upcoming_assessments);
    all_assessments.extend(past_assessments);

    // Process and merge assessments
    for mut assessment in all_assessments {
        // Skip assessments without IDs
        let id = match assessment.get("id").and_then(|v| v.as_i64()) {
            Some(id) => id as i32,
            None => continue, // Skip assessments without IDs
        };

        // Extract finalGrade
        if let Some(final_grade) = extract_final_grade(&assessment) {
            assessment["finalGrade"] = json!(final_grade);
        }

        // Extract letterGrade
        if let Some(letter_grade) = extract_letter_grade(&assessment) {
            assessment["letterGrade"] = json!(letter_grade);
        }

        // Merge with existing: keep existing if it has finalGrade and new doesn't, or update if new has more complete data
        if let Some(existing) = existing_map.get(&id) {
            let existing_has_grade = existing.get("finalGrade").is_some();
            let new_has_grade = assessment.get("finalGrade").is_some();

            // If existing has grade and new doesn't, keep existing
            if existing_has_grade && !new_has_grade {
                continue; // Skip this assessment, keep existing
            }
        }

        // Update or insert the assessment
        existing_map.insert(id, assessment);
    }

    // Convert back to Vec and sort by due date
    let mut final_assessments: Vec<Value> = existing_map.into_values().collect();
    final_assessments.sort_by(|a, b| {
        let due_a = a.get("due").and_then(|d| d.as_str()).unwrap_or("");
        let due_b = b.get("due").and_then(|d| d.as_str()).unwrap_or("");
        due_b.cmp(due_a) // Descending (newest first)
    });

    // Save to file
    let json_data = serde_json::to_string_pretty(&final_assessments)
        .map_err(|e| format!("Failed to serialize analytics data: {}", e))?;

    fs::write(&path, json_data).map_err(|e| format!("Failed to write analytics file: {}", e))?;

    if let Some(logger) = logger::get_logger() {
        let _ = logger.log(
            logger::LogLevel::INFO,
            "analytics",
            "sync_analytics_data",
            "Completed analytics data sync",
            json!({
                "total_assessments": final_assessments.len()
            }),
        );
    }

    Ok("Analytics data synced successfully".to_string())
}
