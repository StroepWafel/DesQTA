use super::netgrab;
use super::netgrab::RequestMethod;
use crate::logger;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;

// --- Struct Definitions ---

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Subject {
    pub code: String,
    pub classunit: Option<i32>,
    pub description: Option<String>,
    pub metaclass: i32,
    pub title: String,
    pub programme: i32,
    pub marksbook_type: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Folder {
    pub code: String,
    pub subjects: Vec<Subject>,
    pub description: Option<String>,
    #[serde(default, deserialize_with = "deserialize_bool_from_int_or_bool")]
    pub active: bool,
    pub id: Option<i32>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FileItem {
    pub filename: String,
    pub size: String,
    pub context_uuid: Option<String>,
    pub mimetype: String,
    pub id: i32,
    pub created_date: String,
    pub uuid: String,
    pub created_by: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Lesson {
    pub p: Option<String>, // Period
    pub s: String, // Start time
    pub d: String, // Date
    pub e: String, // End time
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TermSchedule {
    pub t: i32,         // Term number
    pub w: i32,         // Week number
    pub l: Vec<Lesson>, // Lessons
    pub n: i32,         // Index
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UserFile {
    pub userfile: Option<i32>,
    pub filename: String,
    pub t: String,
    pub size: String,
    pub context_uuid: Option<String>,
    pub i: Option<i32>,
    pub mimetype: String,
    pub created_date: String,
    pub uuid: String,
    pub created_by: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LessonDocument {
    #[serde(rename = "updatedBy")]
    pub updated_by: Option<i32>,
    pub contents: String,
    pub id: Option<i32>,
    #[serde(rename = "updatedDate")]
    pub updated_date: Option<Vec<i32>>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct WeeklyLessonContent {
    pub t: Option<String>, // Topic
    pub document: Option<LessonDocument>,
    pub h: Option<String>, // Homework/Notes
    pub i: Option<i32>,
    pub l: Option<String>,
    pub n: Option<i32>,
    pub r: Option<Vec<UserFile>>, // Resources
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CoursePayload {
    pub c: String,                        // Course code
    pub cf: Vec<FileItem>,                // Course files
    pub t: String,                        // Title
    pub im: Option<String>,               // Image UUID
    #[serde(default)]
    pub d: Vec<TermSchedule>,             // Schedule
    pub u: Option<String>,                // Unique ID
    pub document: Option<String>,         // JSON string for main content
    #[serde(default)]
    pub w: Vec<Vec<WeeklyLessonContent>>, // Weekly lesson content
}

// --- Helper Functions ---

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

// --- Commands ---

#[tauri::command]
pub async fn get_courses_subjects() -> Result<Vec<Folder>, String> {
    if let Some(logger) = logger::get_logger() {
        let _ = logger.log(
            logger::LogLevel::INFO,
            "courses",
            "get_courses_subjects",
            "Fetching subjects for courses",
            json!({}),
        );
    }

    let body = json!({});

    let response = netgrab::fetch_api_data(
        "/seqta/student/load/subjects?",
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
        None,
    )
    .await?;

    // Handle potential double encoding (string inside string)
    let data_value: Value = if let Ok(val) = serde_json::from_str::<Value>(&response) {
        if val.is_string() {
            serde_json::from_str(val.as_str().unwrap())
                .map_err(|e| format!("Failed to parse nested JSON: {}", e))?
        } else {
            val
        }
    } else {
        return Err("Failed to parse response JSON".to_string());
    };

    let payload = data_value.get("payload").ok_or("No payload in response")?;

    let folders: Vec<Folder> = serde_json::from_value(payload.clone())
        .map_err(|e| format!("Failed to deserialize folders: {}", e))?;

    Ok(folders)
}

#[tauri::command]
pub async fn get_course_content(programme: i32, metaclass: i32) -> Result<CoursePayload, String> {
    if let Some(logger) = logger::get_logger() {
        let _ = logger.log(
            logger::LogLevel::INFO,
            "courses",
            "get_course_content",
            &format!(
                "Fetching course content for p:{} m:{}",
                programme, metaclass
            ),
            json!({ "programme": programme, "metaclass": metaclass }),
        );
    }

    let body = json!({
        "programme": programme.to_string(),
        "metaclass": metaclass.to_string(),
    });

    let response = netgrab::fetch_api_data(
        "/seqta/student/load/courses",
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
        None,
    )
    .await?;

    let data_value: Value =
        serde_json::from_str(&response).map_err(|e| format!("Failed to parse response: {}", e))?;

    let payload = data_value.get("payload").ok_or("No payload in response")?;

    let course_payload: CoursePayload = serde_json::from_value(payload.clone())
        .map_err(|e| format!("Failed to deserialize course payload: {}", e))?;

    Ok(course_payload)
}
