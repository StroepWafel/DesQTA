use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::{HashMap, HashSet};
use crate::logger;
use super::netgrab;
use super::netgrab::RequestMethod;

const STUDENT_ID: i32 = 69;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Subject {
    pub code: String,
    pub programme: i32,
    pub metaclass: i32,
    pub title: Option<String>,
    pub description: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Folder {
    #[serde(deserialize_with = "deserialize_bool_from_int_or_bool")]
    pub active: bool,
    pub subjects: Vec<Subject>,
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

#[derive(Debug, Serialize, Deserialize)]
pub struct Assessment {
    pub id: i32,
    pub code: String,
    pub title: String,
    pub due: String,
    pub colour: String,
    pub metaclass: Option<i32>,
    #[serde(flatten)]
    pub extra: HashMap<String, Value>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ProcessedAssessmentsResponse {
    pub assessments: Vec<Assessment>,
    pub subjects: Vec<Subject>,
    pub all_subjects: Vec<Subject>,
    pub filters: HashMap<String, bool>,
    pub years: Vec<i32>,
}

/// Fetch lesson colours from SEQTA API
async fn fetch_lesson_colours() -> Result<Vec<Value>, String> {
    let body = json!({
        "request": "userPrefs",
        "asArray": true,
        "user": STUDENT_ID
    });

    let response = netgrab::fetch_api_data(
        "/seqta/student/load/prefs?",
        RequestMethod::POST,
        Some({
            let mut headers = HashMap::new();
            headers.insert("Content-Type".to_string(), "application/json; charset=utf-8".to_string());
            headers
        }),
        Some(body),
        None,
        false,
        false,
    )
    .await?;

    let data: Value = serde_json::from_str(&response)
        .map_err(|e| format!("Failed to parse lesson colours: {}", e))?;

    Ok(data["payload"]
        .as_array()
        .cloned()
        .unwrap_or_default())
}

/// Fetch subjects from SEQTA API
async fn fetch_subjects() -> Result<Vec<Folder>, String> {
    let body = json!({});

    let response = netgrab::fetch_api_data(
        "/seqta/student/load/subjects?",
        RequestMethod::POST,
        Some({
            let mut headers = HashMap::new();
            headers.insert("Content-Type".to_string(), "application/json; charset=utf-8".to_string());
            headers
        }),
        Some(body),
        None,
        false,
        false,
    )
    .await?;

    let data: Value = serde_json::from_str(&response)
        .map_err(|e| format!("Failed to parse subjects: {}", e))?;

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
        "/seqta/student/assessment/list/upcoming?",
        RequestMethod::POST,
        Some({
            let mut headers = HashMap::new();
            headers.insert("Content-Type".to_string(), "application/json; charset=utf-8".to_string());
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

    Ok(data["payload"]
        .as_array()
        .cloned()
        .unwrap_or_default())
}

/// Fetch past assessments for a specific subject
async fn fetch_past_assessments(programme: i32, metaclass: i32) -> Result<Vec<Value>, String> {
    let body = json!({
        "programme": programme,
        "metaclass": metaclass,
        "student": STUDENT_ID
    });

    let response = netgrab::fetch_api_data(
        "/seqta/student/assessment/list/past?",
        RequestMethod::POST,
        Some({
            let mut headers = HashMap::new();
            headers.insert("Content-Type".to_string(), "application/json; charset=utf-8".to_string());
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

    Ok(data["payload"]["tasks"]
        .as_array()
        .cloned()
        .unwrap_or_default())
}

/// Process and merge all assessments data
#[tauri::command]
pub async fn get_processed_assessments() -> Result<ProcessedAssessmentsResponse, String> {
    if let Some(logger) = logger::get_logger() {
        let _ = logger.log(
            logger::LogLevel::INFO,
            "assessments",
            "get_processed_assessments",
            "Starting assessments processing",
            json!({}),
        );
    }

    // Step 1: Fetch subjects and lesson colours in parallel
    let (folders_result, colours_result) = tokio::join!(
        fetch_subjects(),
        fetch_lesson_colours()
    );

    let folders = folders_result?;
    let colours = colours_result?;

    // Step 2: Process subjects
    let all_subjects: Vec<Subject> = folders
        .iter()
        .flat_map(|f| f.subjects.clone())
        .collect();

    // Remove duplicates by programme+metaclass
    let mut unique_subjects_map: HashMap<String, Subject> = HashMap::new();
    for subject in all_subjects {
        let key = format!("{}-{}", subject.programme, subject.metaclass);
        if !unique_subjects_map.contains_key(&key) {
            unique_subjects_map.insert(key, subject);
        }
    }
    let all_subjects: Vec<Subject> = unique_subjects_map.into_values().collect();

    // Get active subjects
    let active_folder = folders.iter().find(|f| f.active);
    let active_subjects: Vec<Subject> = active_folder
        .map(|f| f.subjects.clone())
        .unwrap_or_default();

    // Initialize subject filters
    let mut filters: HashMap<String, bool> = HashMap::new();
    for subject in &all_subjects {
        let is_active = active_subjects.iter().any(|as_subj| as_subj.code == subject.code);
        filters.insert(subject.code.clone(), is_active);
    }

    // Step 3: Fetch upcoming assessments
    let upcoming_assessments = fetch_upcoming_assessments().await?;

    // Step 4: Fetch past assessments for all subjects in parallel
    let mut past_futures = Vec::new();
    for subject in &all_subjects {
        past_futures.push(fetch_past_assessments(subject.programme, subject.metaclass));
    }

    let past_results = futures::future::join_all(past_futures).await;
    let past_assessments: Vec<Value> = past_results
        .into_iter()
        .filter_map(|r| r.ok())
        .flatten()
        .collect();

    // Step 5: Combine and deduplicate assessments
    let mut all_assessments: Vec<Value> = upcoming_assessments;
    all_assessments.extend(past_assessments);

    // Remove duplicates by id
    let mut unique_assessments_map: HashMap<i32, Value> = HashMap::new();
    for assessment in all_assessments {
        if let Some(id) = assessment.get("id").and_then(|v| v.as_i64()) {
            let id = id as i32;
            if !unique_assessments_map.contains_key(&id) {
                unique_assessments_map.insert(id, assessment);
            }
        }
    }

    // Step 6: Process assessments - add colours and metaclass
    let mut processed_assessments: Vec<Assessment> = Vec::new();
    for (_, assessment_value) in unique_assessments_map {
        let assessment_obj = assessment_value.as_object().cloned().unwrap_or_default();
        
        // Get assessment code
        let code = assessment_obj
            .get("code")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();

        // Find colour from preferences
        let pref_name = format!("timetable.subject.colour.{}", code);
        let colour = colours
            .iter()
            .find(|c| c.get("name").and_then(|v| v.as_str()) == Some(&pref_name))
            .and_then(|c| c.get("value").and_then(|v| v.as_str()))
            .unwrap_or("#8e8e8e")
            .to_string();

        // Get metaclass from subject
        let metaclass = all_subjects
            .iter()
            .find(|s| s.code == code)
            .map(|s| s.metaclass);

        // Build assessment struct
        let extra_map: HashMap<String, Value> = assessment_obj
            .iter()
            .map(|(k, v)| (k.clone(), v.clone()))
            .collect();

        let assessment = Assessment {
            id: assessment_obj
                .get("id")
                .and_then(|v| v.as_i64())
                .unwrap_or(0) as i32,
            code: code.clone(),
            title: assessment_obj
                .get("title")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string(),
            due: assessment_obj
                .get("due")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string(),
            colour,
            metaclass,
            extra: extra_map,
        };

        processed_assessments.push(assessment);
    }

    // Step 7: Sort by due date (descending)
    processed_assessments.sort_by(|a, b| {
        // Parse dates - format is typically "YYYY-MM-DDTHH:mm:ss" or "YYYY-MM-DD HH:mm:ss"
        // Extract date part and compare as strings (ISO format sorts correctly)
        let date_a_str = if let Some(date_part) = a.due.split('T').next().or_else(|| a.due.split(' ').next()) {
            date_part
        } else {
            &a.due
        };
        let date_b_str = if let Some(date_part) = b.due.split('T').next().or_else(|| b.due.split(' ').next()) {
            date_part
        } else {
            &b.due
        };
        // Compare dates (ISO format YYYY-MM-DD sorts correctly as strings)
        date_b_str.cmp(date_a_str)
    });

    // Step 8: Extract years
    let mut years_set: HashSet<i32> = HashSet::new();
    for assessment in &processed_assessments {
        // Parse date string (format: "YYYY-MM-DDTHH:mm:ss" or "YYYY-MM-DD HH:mm:ss")
        if let Some(date_part) = assessment.due.split('T').next().or_else(|| assessment.due.split(' ').next()) {
            if let Some(year_str) = date_part.split('-').next() {
                if let Ok(year) = year_str.parse::<i32>() {
                    years_set.insert(year);
                }
            }
        }
    }
    let mut years: Vec<i32> = years_set.into_iter().collect();
    years.sort_by(|a, b| b.cmp(a)); // Sort descending

    if let Some(logger) = logger::get_logger() {
        let _ = logger.log(
            logger::LogLevel::INFO,
            "assessments",
            "get_processed_assessments",
            "Completed assessments processing",
            json!({
                "assessments_count": processed_assessments.len(),
                "subjects_count": active_subjects.len(),
                "all_subjects_count": all_subjects.len(),
                "years": years
            }),
        );
    }

    Ok(ProcessedAssessmentsResponse {
        assessments: processed_assessments,
        subjects: active_subjects,
        all_subjects,
        filters,
        years,
    })
}

