use crate::netgrab;
use crate::netgrab::RequestMethod;
use anyhow::{anyhow, Result};
use chrono::Datelike;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};
use std::time::{SystemTime, UNIX_EPOCH};

/// Static empty array slice for use as default value
static EMPTY_ARRAY: &[Value] = &[];

/// Cache entry with timestamp
#[derive(Clone)]
struct CacheEntry {
    data: Vec<SeqtaMentionItem>,
    timestamp: u64,
}

/// In-memory cache for mention search results
static MENTION_CACHE: OnceLock<Mutex<HashMap<String, CacheEntry>>> = OnceLock::new();
const CACHE_DURATION_MS: u64 = 5 * 60 * 1000; // 5 minutes

/// Teacher cache (key: programme-metaclass-code)
static TEACHER_CACHE: OnceLock<Mutex<HashMap<String, String>>> = OnceLock::new();

/// Mention type enum matching TypeScript
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum MentionType {
    Assignment,
    Assessment,
    Class,
    Subject,
    Timetable,
    TimetableSlot,
    Notice,
    File,
    Homework,
    Teacher,
    LessonContent,
}

/// SeqtaMentionItem matching TypeScript interface
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SeqtaMentionItem {
    pub id: String,
    #[serde(rename = "type")]
    pub mention_type: MentionType,
    pub title: String,
    pub subtitle: String,
    pub data: Value,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_updated: Option<String>,
}

/// Initialize caches
fn init_caches() {
    MENTION_CACHE.get_or_init(|| Mutex::new(HashMap::new()));
    TEACHER_CACHE.get_or_init(|| Mutex::new(HashMap::new()));
}

/// Get current timestamp in milliseconds
fn current_timestamp_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_millis() as u64
}

/// Check if cache entry is still valid
fn is_cache_valid(entry: &CacheEntry) -> bool {
    current_timestamp_ms() - entry.timestamp < CACHE_DURATION_MS
}

/// Get cached data if valid
fn get_cached(key: &str) -> Option<Vec<SeqtaMentionItem>> {
    init_caches();
    let cache = MENTION_CACHE.get().unwrap().lock().unwrap();
    if let Some(entry) = cache.get(key) {
        if is_cache_valid(entry) {
            return Some(entry.data.clone());
        }
    }
    None
}

/// Set cache entry
fn set_cache(key: String, data: Vec<SeqtaMentionItem>) {
    init_caches();
    let mut cache = MENTION_CACHE.get().unwrap().lock().unwrap();
    cache.insert(
        key,
        CacheEntry {
            data,
            timestamp: current_timestamp_ms(),
        },
    );
}

/// Format date for subtitle
fn format_date(date_str: &str) -> String {
    // Simple date formatting - can be enhanced later
    date_str.to_string()
}

/// Fetch assignments from SEQTA
async fn fetch_assignments(
    query: &str,
    category_filter: Option<&str>,
) -> Result<Vec<SeqtaMentionItem>> {
    let student_id = 69; // TODO: Get from session

    let body = json!({
        "student": student_id
    });

    let headers = HashMap::from([(
        "Content-Type".to_string(),
        "application/json; charset=utf-8".to_string(),
    )]);

    let response = netgrab::fetch_api_data(
        "/seqta/student/assessment/list/upcoming?",
        RequestMethod::POST,
        Some(headers),
        Some(body),
        None,
        false,
        false,
        None,
    )
    .await
    .map_err(|e| anyhow!("Failed to fetch assignments: {}", e))?;

    let json_response: Value = serde_json::from_str(&response)
        .map_err(|e| anyhow!("Failed to parse assignments response: {}", e))?;

    let assignments = json_response["payload"]
        .as_array()
        .map(|v| v.as_slice())
        .unwrap_or(EMPTY_ARRAY);

    let limit = if category_filter == Some("assignment") || category_filter == Some("assessment") {
        100
    } else {
        10
    };

    let query_lower = query.to_lowercase();
    let filtered: Vec<SeqtaMentionItem> = assignments
        .iter()
        .filter(|a| {
            if query.is_empty() {
                return true;
            }
            let title = a["title"].as_str().unwrap_or("").to_lowercase();
            let subject = a["subject"]
                .as_str()
                .or_else(|| a["code"].as_str())
                .unwrap_or("")
                .to_lowercase();
            title.contains(&query_lower) || subject.contains(&query_lower)
        })
        .take(limit)
        .map(|assignment| {
            let id_val = assignment["id"].as_i64().unwrap_or(0);
            let title = assignment["title"]
                .as_str()
                .unwrap_or("Assignment")
                .to_string();
            let subject = assignment["subject"]
                .as_str()
                .or_else(|| assignment["code"].as_str())
                .unwrap_or("Unknown");
            let due = assignment["due"].as_str().unwrap_or("");

            SeqtaMentionItem {
                id: format!("assignment-{}", id_val),
                mention_type: MentionType::Assignment,
                title: title.clone(),
                subtitle: format!("{} • Due: {}", subject, format_date(due)),
                data: json!({
                    "id": id_val,
                    "title": title,
                    "subject": subject,
                    "dueDate": due,
                    "status": "pending",
                    "description": assignment["description"].as_str().unwrap_or("")
                }),
                last_updated: Some(chrono::Utc::now().to_rfc3339()),
            }
        })
        .collect();

    Ok(filtered)
}

/// Fetch classes from SEQTA
async fn fetch_classes(
    query: &str,
    category_filter: Option<&str>,
) -> Result<Vec<SeqtaMentionItem>> {
    let body = json!({});

    let headers = HashMap::from([(
        "Content-Type".to_string(),
        "application/json; charset=utf-8".to_string(),
    )]);

    let response = netgrab::fetch_api_data(
        "/seqta/student/load/subjects?",
        RequestMethod::POST,
        Some(headers),
        Some(body),
        None,
        false,
        false,
        None,
    )
    .await
    .map_err(|e| anyhow!("Failed to fetch classes: {}", e))?;

    let json_response: Value = serde_json::from_str(&response)
        .map_err(|e| anyhow!("Failed to parse classes response: {}", e))?;

    let folders = json_response["payload"]
        .as_array()
        .map(|v| v.as_slice())
        .unwrap_or(EMPTY_ARRAY);

    let all_subjects: Vec<&Value> = folders
        .iter()
        .flat_map(|folder| {
            folder["subjects"]
                .as_array()
                .map(|v| v.as_slice())
                .unwrap_or(EMPTY_ARRAY)
        })
        .collect();

    let limit = if category_filter == Some("class") {
        100
    } else {
        10
    };
    let query_lower = query.to_lowercase();

    let mut results = Vec::new();
    for subject in all_subjects.iter().take(limit) {
        let title = subject["title"]
            .as_str()
            .or_else(|| subject["code"].as_str())
            .unwrap_or("Unknown");
        let code = subject["code"].as_str().unwrap_or("");

        if !query.is_empty() {
            if !title.to_lowercase().contains(&query_lower)
                && !code.to_lowercase().contains(&query_lower)
            {
                continue;
            }
        }

        let programme = subject["programme"].as_i64();
        let metaclass = subject["metaclass"].as_i64();
        let teacher = subject["teacher"].as_str().unwrap_or("Teacher TBA");

        // Try to get teacher from timetable (async, but we'll simplify for now)
        let final_teacher = teacher.to_string();

        let id = if let (Some(p), Some(m)) = (programme, metaclass) {
            format!("{}-{}", p, m)
        } else {
            format!("class-{}", code)
        };

        results.push(SeqtaMentionItem {
            id: id.clone(),
            mention_type: MentionType::Class,
            title: title.to_string(),
            subtitle: format!("{} • {}", code, final_teacher),
            data: json!({
                "id": id,
                "name": title,
                "subject": code,
                "code": code,
                "year": subject["year"].as_i64().unwrap_or(10),
                "teacher": final_teacher,
                "programme": programme,
                "metaclass": metaclass,
            }),
            last_updated: Some(chrono::Utc::now().to_rfc3339()),
        });
    }

    Ok(results)
}

/// Fetch subjects (similar to classes but different presentation)
async fn fetch_subjects(
    query: &str,
    category_filter: Option<&str>,
) -> Result<Vec<SeqtaMentionItem>> {
    // Subjects are essentially the same as classes, just formatted differently
    let classes = fetch_classes(query, category_filter).await?;

    Ok(classes
        .into_iter()
        .map(|mut item| {
            item.id = format!("subject-{}", item.id);
            item.mention_type = MentionType::Subject;
            item.subtitle = format!(
                "{} • {} • Active",
                item.data["code"].as_str().unwrap_or(""),
                item.data["teacher"].as_str().unwrap_or("Teacher TBA")
            );
            item
        })
        .collect())
}

/// Fetch timetable slots
async fn fetch_timetable_slots(
    query: &str,
    category_filter: Option<&str>,
) -> Result<Vec<SeqtaMentionItem>> {
    let student_id = 69; // TODO: Get from session

    let start = chrono::Utc::now();
    let end = start + chrono::Duration::days(14);
    let from = start.format("%Y-%m-%d").to_string();
    let until = end.format("%Y-%m-%d").to_string();

    let body = json!({
        "from": from,
        "until": until,
        "student": student_id
    });

    let headers = HashMap::from([("Content-Type".to_string(), "application/json".to_string())]);

    let response = netgrab::fetch_api_data(
        "/seqta/student/load/timetable?",
        RequestMethod::POST,
        Some(headers),
        Some(body),
        None,
        false,
        false,
        None,
    )
    .await
    .map_err(|e| anyhow!("Failed to fetch timetable: {}", e))?;

    let json_response: Value = serde_json::from_str(&response)
        .map_err(|e| anyhow!("Failed to parse timetable response: {}", e))?;

    let items = json_response["payload"]["items"]
        .as_array()
        .map(|v| v.as_slice())
        .unwrap_or(EMPTY_ARRAY);

    let limit = if category_filter == Some("timetable_slot") {
        100
    } else {
        20
    };
    let query_lower = query.to_lowercase();

    let results: Vec<SeqtaMentionItem> = items
        .iter()
        .filter(|lesson| {
            if query.is_empty() {
                return true;
            }
            let code = lesson["code"].as_str().unwrap_or("").to_lowercase();
            let title = lesson["title"].as_str().unwrap_or("").to_lowercase();
            let desc = lesson["description"].as_str().unwrap_or("").to_lowercase();
            code.contains(&query_lower)
                || title.contains(&query_lower)
                || desc.contains(&query_lower)
        })
        .take(limit)
        .map(|lesson| {
            let date = lesson["date"]
                .as_str()
                .or_else(|| lesson["from"].as_str().and_then(|s| s.split('T').next()))
                .unwrap_or("");

            let from_time = lesson["from"]
                .as_str()
                .and_then(|s| {
                    if s.len() >= 5 {
                        Some(s[..5].to_string())
                    } else if s.len() >= 16 {
                        Some(s[11..16].to_string())
                    } else {
                        None
                    }
                })
                .unwrap_or_else(|| "".to_string());

            let until_time = lesson["until"]
                .as_str()
                .and_then(|s| {
                    if s.len() >= 5 {
                        Some(s[..5].to_string())
                    } else if s.len() >= 16 {
                        Some(s[11..16].to_string())
                    } else {
                        None
                    }
                })
                .unwrap_or_else(|| "".to_string());

            let day_name = chrono::NaiveDate::parse_from_str(date, "%Y-%m-%d")
                .ok()
                .map(|d| d.format("%a").to_string())
                .unwrap_or_else(|| "".to_string());

            let code = lesson["code"].as_str().unwrap_or("");
            let title = lesson["title"]
                .as_str()
                .or_else(|| lesson["description"].as_str())
                .unwrap_or("Lesson");
            let room = lesson["room"].as_str().unwrap_or("TBA");
            let id_val = lesson["id"].as_i64().or_else(|| Some(0)).unwrap_or(0);

            SeqtaMentionItem {
                id: format!(
                    "timetable-slot-{}",
                    if id_val > 0 {
                        id_val.to_string()
                    } else {
                        format!("{}-{}", date, from_time)
                    }
                ),
                mention_type: MentionType::TimetableSlot,
                title: format!("{} {}-{}", code, from_time, until_time),
                subtitle: format!("{} {} • Room {}", day_name, date, room),
                data: json!({
                    "id": id_val,
                    "date": date,
                    "from": from_time,
                    "until": until_time,
                    "code": code,
                    "title": title,
                    "room": room,
                    "teacher": lesson["staff"].as_str()
                        .or_else(|| lesson["teacher"].as_str())
                        .unwrap_or(""),
                    "programme": lesson["programmeID"],
                    "metaclass": lesson["metaID"],
                }),
                last_updated: Some(chrono::Utc::now().to_rfc3339()),
            }
        })
        .collect();

    Ok(results)
}

/// Fetch notices
async fn fetch_notices(
    query: &str,
    category_filter: Option<&str>,
) -> Result<Vec<SeqtaMentionItem>> {
    let today = chrono::Utc::now().format("%Y-%m-%d").to_string();

    let body = json!({
        "date": today
    });

    let headers = HashMap::from([("Content-Type".to_string(), "application/json".to_string())]);

    let response = netgrab::fetch_api_data(
        "/seqta/student/load/notices?",
        RequestMethod::POST,
        Some(headers),
        Some(body),
        None,
        false,
        false,
        None,
    )
    .await
    .map_err(|e| anyhow!("Failed to fetch notices: {}", e))?;

    let json_response: Value = serde_json::from_str(&response)
        .map_err(|e| anyhow!("Failed to parse notices response: {}", e))?;

    let notices = json_response["payload"]
        .as_array()
        .map(|v| v.as_slice())
        .unwrap_or(EMPTY_ARRAY);

    let limit = if category_filter == Some("notice") {
        100
    } else {
        20
    };
    let query_lower = query.to_lowercase();

    let results: Vec<SeqtaMentionItem> = notices
        .iter()
        .enumerate()
        .filter(|(_, notice)| {
            if query.is_empty() {
                return true;
            }
            let title = notice["title"].as_str().unwrap_or("").to_lowercase();
            let label = notice["label_title"].as_str().unwrap_or("").to_lowercase();
            let staff = notice["staff"].as_str().unwrap_or("").to_lowercase();
            title.contains(&query_lower)
                || label.contains(&query_lower)
                || staff.contains(&query_lower)
        })
        .take(limit)
        .map(|(index, notice)| {
            let id_val = notice["id"].as_i64().unwrap_or(index as i64);
            let title = notice["title"].as_str().unwrap_or("Notice").to_string();
            let label = notice["label_title"].as_str().unwrap_or("Notice");
            let staff = notice["staff"].as_str().unwrap_or("Staff");

            SeqtaMentionItem {
                id: format!("notice-{}", id_val),
                mention_type: MentionType::Notice,
                title: title.clone(),
                subtitle: format!("{} • {}", label, staff),
                data: json!({
                    "id": id_val,
                    "title": title,
                    "subtitle": label,
                    "author": staff,
                    "color": notice["colour"],
                    "labelId": notice["label"],
                    "content": notice["contents"],
                    "date": today,
                }),
                last_updated: Some(chrono::Utc::now().to_rfc3339()),
            }
        })
        .collect();

    Ok(results)
}

/// Fetch homework
async fn fetch_homework(
    query: &str,
    category_filter: Option<&str>,
) -> Result<Vec<SeqtaMentionItem>> {
    let body = json!({});

    let headers = HashMap::from([("Content-Type".to_string(), "application/json".to_string())]);

    let mut params = HashMap::new();
    params.insert("majhvjju".to_string(), "".to_string());

    let response = netgrab::fetch_api_data(
        "/seqta/student/dashlet/summary/homework",
        RequestMethod::POST,
        Some(headers),
        Some(body),
        Some(params),
        false,
        false,
        None,
    )
    .await
    .map_err(|e| anyhow!("Failed to fetch homework: {}", e))?;

    let json_response: Value = serde_json::from_str(&response)
        .map_err(|e| anyhow!("Failed to parse homework response: {}", e))?;

    let homework_items = json_response["payload"]
        .as_array()
        .map(|v| v.as_slice())
        .unwrap_or(&[]);

    let limit = if category_filter == Some("homework") {
        100
    } else {
        20
    };
    let query_lower = query.to_lowercase();

    let results: Vec<SeqtaMentionItem> = homework_items
        .iter()
        .filter(|homework| {
            if query.is_empty() {
                return true;
            }
            let title = homework["title"].as_str().unwrap_or("").to_lowercase();
            let items = homework["items"]
                .as_array()
                .map(|v| v.as_slice())
                .unwrap_or(EMPTY_ARRAY);
            let items_match = items.iter().any(|item| {
                item.as_str()
                    .unwrap_or("")
                    .to_lowercase()
                    .contains(&query_lower)
            });
            title.contains(&query_lower) || items_match
        })
        .take(limit)
        .map(|homework| {
            let id_val = homework["id"]
                .as_i64()
                .or_else(|| homework["meta"].as_i64())
                .unwrap_or(0);
            let title = homework["title"].as_str().unwrap_or("Homework").to_string();
            let items = homework["items"]
                .as_array()
                .map(|v| v.as_slice())
                .unwrap_or(EMPTY_ARRAY);
            let item_count = items.len();

            SeqtaMentionItem {
                id: format!("homework-{}", id_val),
                mention_type: MentionType::Homework,
                title: title.clone(),
                subtitle: format!(
                    "{} {}",
                    item_count,
                    if item_count == 1 { "item" } else { "items" }
                ),
                data: json!({
                    "id": id_val,
                    "meta": homework["meta"],
                    "title": title,
                    "items": items,
                }),
                last_updated: Some(chrono::Utc::now().to_rfc3339()),
            }
        })
        .collect();

    Ok(results)
}

/// Fetch staff/teachers
async fn fetch_staff(query: &str, category_filter: Option<&str>) -> Result<Vec<SeqtaMentionItem>> {
    let body = json!({
        "mode": "staff"
    });

    let headers = HashMap::from([("Content-Type".to_string(), "application/json".to_string())]);

    let response = netgrab::fetch_api_data(
        "/seqta/student/load/message/people",
        RequestMethod::POST,
        Some(headers),
        Some(body),
        None,
        false,
        false,
        None,
    )
    .await
    .map_err(|e| anyhow!("Failed to fetch staff: {}", e))?;

    let json_response: Value = if response.starts_with('{') {
        serde_json::from_str(&response)
            .map_err(|e| anyhow!("Failed to parse staff response: {}", e))?
    } else {
        json!({})
    };

    let staff = json_response["payload"]
        .as_array()
        .map(|v| v.as_slice())
        .unwrap_or(EMPTY_ARRAY);

    let limit = if category_filter == Some("teacher") {
        100
    } else {
        20
    };
    let query_lower = query.to_lowercase();

    let results: Vec<SeqtaMentionItem> = staff
        .iter()
        .filter(|teacher| {
            if query.is_empty() {
                return true;
            }
            let name = teacher["name"].as_str().unwrap_or("").to_lowercase();
            let email = teacher["email"].as_str().unwrap_or("").to_lowercase();
            name.contains(&query_lower) || email.contains(&query_lower)
        })
        .take(limit)
        .map(|teacher| {
            let id_val = teacher["id"].as_i64().unwrap_or(0);
            let name = teacher["name"].as_str().unwrap_or("Teacher").to_string();
            let email = teacher["email"].as_str().unwrap_or("");

            SeqtaMentionItem {
                id: format!("teacher-{}", id_val),
                mention_type: MentionType::Teacher,
                title: name.clone(),
                subtitle: email.to_string(),
                data: json!({
                    "id": id_val,
                    "name": name,
                    "email": email,
                }),
                last_updated: Some(chrono::Utc::now().to_rfc3339()),
            }
        })
        .collect();

    Ok(results)
}

/// Fetch timetables (simplified - returns empty for now)
async fn fetch_timetables(
    _query: &str,
    _category_filter: Option<&str>,
) -> Result<Vec<SeqtaMentionItem>> {
    // Timetables are typically date-based views, not individual items
    // Return empty for now - can be implemented later if needed
    Ok(vec![])
}

/// Sort items by relevance
fn sort_by_relevance(items: &mut [SeqtaMentionItem], query: &str) {
    if query.is_empty() {
        return;
    }

    let query_lower = query.to_lowercase();

    items.sort_by(|a, b| {
        // Exact match priority
        let a_exact = a.title.to_lowercase() == query_lower;
        let b_exact = b.title.to_lowercase() == query_lower;
        if a_exact && !b_exact {
            return std::cmp::Ordering::Less;
        }
        if !a_exact && b_exact {
            return std::cmp::Ordering::Greater;
        }

        // Starts with priority
        let a_starts = a.title.to_lowercase().starts_with(&query_lower);
        let b_starts = b.title.to_lowercase().starts_with(&query_lower);
        if a_starts && !b_starts {
            return std::cmp::Ordering::Less;
        }
        if !a_starts && b_starts {
            return std::cmp::Ordering::Greater;
        }

        // Type priority
        let type_priority = |t: &MentionType| -> i32 {
            match t {
                MentionType::Assignment | MentionType::Assessment => 1,
                MentionType::Homework => 2,
                MentionType::Class => 3,
                MentionType::Subject => 4,
                MentionType::Timetable => 5,
                MentionType::TimetableSlot => 6,
                MentionType::Notice => 7,
                MentionType::Teacher => 8,
                MentionType::File => 9,
                _ => 99,
            }
        };

        type_priority(&a.mention_type).cmp(&type_priority(&b.mention_type))
    });
}

/// Main search function
pub async fn search_mentions(
    query: String,
    category_filter: Option<String>,
) -> Result<Vec<SeqtaMentionItem>> {
    let cache_key = format!(
        "search_{}_{}",
        query,
        category_filter.as_deref().unwrap_or("all")
    );

    // Check cache
    if let Some(cached) = get_cached(&cache_key) {
        return Ok(cached);
    }

    // Fetch from all sources in parallel
    let (assignments, classes, subjects, timetables, timetable_slots, notices, homework, staff) = tokio::try_join!(
        fetch_assignments(&query, category_filter.as_deref()),
        fetch_classes(&query, category_filter.as_deref()),
        fetch_subjects(&query, category_filter.as_deref()),
        fetch_timetables(&query, category_filter.as_deref()),
        fetch_timetable_slots(&query, category_filter.as_deref()),
        fetch_notices(&query, category_filter.as_deref()),
        fetch_homework(&query, category_filter.as_deref()),
        fetch_staff(&query, category_filter.as_deref()),
    )?;

    // Combine all items
    let mut all_items = Vec::new();
    all_items.extend(assignments);
    all_items.extend(classes);
    all_items.extend(subjects);
    all_items.extend(timetables);
    all_items.extend(timetable_slots);
    all_items.extend(notices);
    all_items.extend(homework);
    all_items.extend(staff);

    // Filter by query if provided
    if !query.trim().is_empty() {
        let query_lower = query.to_lowercase();
        all_items.retain(|item| {
            item.title.to_lowercase().contains(&query_lower)
                || item.subtitle.to_lowercase().contains(&query_lower)
                || format!("{:?}", item.mention_type)
                    .to_lowercase()
                    .contains(&query_lower)
        });
    }

    // Sort by relevance
    sort_by_relevance(&mut all_items, &query);

    // Limit results
    let limit = if category_filter.is_some() { 100 } else { 50 };
    all_items.truncate(limit);

    // Cache results
    set_cache(cache_key, all_items.clone());

    Ok(all_items)
}

/// Search with context (simplified - just calls regular search for now)
pub async fn search_mentions_with_context(
    query: String,
    _note_content: String,
    category_filter: Option<String>,
) -> Result<Vec<SeqtaMentionItem>> {
    // Context-aware search can be enhanced later
    // For now, just use regular search
    search_mentions(query, category_filter).await
}

/// Fetch assignment/assessment by ID
async fn fetch_assignment_by_id(
    id: String,
    meta: Option<Value>,
) -> Result<Option<SeqtaMentionItem>> {
    let student_id = 69; // TODO: Get from session
    let clean_id = id.replace("assessment-", "").replace("assignment-", "");

    // Try to get programme/metaclass from meta
    let programme = meta
        .as_ref()
        .and_then(|m| m.get("data").and_then(|d| d.get("programme")))
        .or_else(|| {
            meta.as_ref()
                .and_then(|m| m.get("lookup").and_then(|l| l.get("programme")))
        })
        .and_then(|v| v.as_i64());
    let metaclass = meta
        .as_ref()
        .and_then(|m| m.get("data").and_then(|d| d.get("metaclass")))
        .or_else(|| {
            meta.as_ref()
                .and_then(|m| m.get("lookup").and_then(|l| l.get("metaclass")))
        })
        .and_then(|v| v.as_i64());

    // Check upcoming first
    let body = json!({ "student": student_id });
    let headers = HashMap::from([(
        "Content-Type".to_string(),
        "application/json; charset=utf-8".to_string(),
    )]);

    let response = netgrab::fetch_api_data(
        "/seqta/student/assessment/list/upcoming?",
        netgrab::RequestMethod::POST,
        Some(headers.clone()),
        Some(body.clone()),
        None,
        false,
        false,
        None,
    )
    .await
    .map_err(|e| anyhow!("Failed to fetch upcoming assessments: {}", e))?;

    let json_response: Value =
        serde_json::from_str(&response).map_err(|e| anyhow!("Failed to parse response: {}", e))?;

    let upcoming = json_response["payload"]
        .as_array()
        .map(|v| v.as_slice())
        .unwrap_or(EMPTY_ARRAY);

    let found = upcoming.iter().find(|a| {
        let a_id = a["id"].as_i64().map(|i| i.to_string());
        a_id.as_deref() == Some(&clean_id)
            || a_id.as_deref() == Some(&id.replace("assessment-", "").replace("assignment-", ""))
    });

    // If not found, try past assessments
    if found.is_none() && programme.is_some() && metaclass.is_some() {
        let past_body = json!({
            "programme": programme.unwrap(),
            "metaclass": metaclass.unwrap(),
            "student": student_id
        });

        if let Ok(past_response) = netgrab::fetch_api_data(
            "/seqta/student/assessment/list/past?",
            netgrab::RequestMethod::POST,
            Some(headers.clone()),
            Some(past_body),
            None,
            false,
            false,
            None,
        )
        .await
        {
            if let Ok(past_json) = serde_json::from_str::<Value>(&past_response) {
                if let Some(tasks) = past_json["payload"]["tasks"].as_array() {
                    for task in tasks {
                        let task_id = task["id"].as_i64().map(|i| i.to_string());
                        if task_id.as_deref() == Some(&clean_id) {
                            // Create a SeqtaMentionItem from this task
                            let due = task["due"]
                                .as_str()
                                .or_else(|| task["dueDate"].as_str())
                                .unwrap_or("");
                            let subject = task["subject"]
                                .as_str()
                                .or_else(|| task["code"].as_str())
                                .unwrap_or("");

                            let status = if !due.is_empty() {
                                if let Ok(due_dt) = chrono::DateTime::parse_from_rfc3339(due) {
                                    if due_dt.with_timezone(&chrono::Utc) > chrono::Utc::now() {
                                        "pending"
                                    } else {
                                        "overdue"
                                    }
                                } else {
                                    "unknown"
                                }
                            } else {
                                task["status"].as_str().unwrap_or("unknown")
                            };

                            return Ok(Some(SeqtaMentionItem {
                                id: format!("assessment-{}", task["id"].as_i64().unwrap_or(0)),
                                mention_type: MentionType::Assessment,
                                title: task["title"].as_str().unwrap_or("Assessment").to_string(),
                                subtitle: format!("{} • {}", subject, format_date(due)),
                                data: json!({
                                    "id": task["id"],
                                    "title": task["title"],
                                    "subject": subject,
                                    "code": task["code"],
                                    "due": due,
                                    "dueDate": due,
                                    "status": status,
                                    "programme": task.get("programme").or_else(|| task.get("programmeID")).cloned(),
                                    "metaclass": task.get("metaclass").or_else(|| task.get("metaID")).cloned(),
                                }),
                                last_updated: Some(chrono::Utc::now().to_rfc3339()),
                            }));
                        }
                    }
                }
            }
        }
    }

    // If still not found and we have metaclass, try detail endpoint
    if found.is_none() && metaclass.is_some() {
        if let Ok(clean_id_num) = clean_id.parse::<i64>() {
            let detail_body = json!({
                "assessment": clean_id_num,
                "student": student_id,
                "metaclass": metaclass.unwrap()
            });

            if let Ok(detail_response) = netgrab::fetch_api_data(
                "/seqta/student/assessment/get?",
                netgrab::RequestMethod::POST,
                Some(headers),
                Some(detail_body),
                None,
                false,
                false,
                None,
            )
            .await
            {
                if let Ok(detail_json) = serde_json::from_str::<Value>(&detail_response) {
                    if detail_json["payload"]["id"].is_number() {
                        let payload = detail_json["payload"].clone();
                        let due = payload["due"]
                            .as_str()
                            .or_else(|| payload["dueDate"].as_str())
                            .unwrap_or("");
                        let subject = payload["subject"]
                            .as_str()
                            .or_else(|| payload["code"].as_str())
                            .unwrap_or("");

                        let status = if !due.is_empty() {
                            if let Ok(due_dt) = chrono::DateTime::parse_from_rfc3339(due) {
                                if due_dt.with_timezone(&chrono::Utc) > chrono::Utc::now() {
                                    "pending"
                                } else {
                                    "overdue"
                                }
                            } else {
                                "unknown"
                            }
                        } else {
                            payload["status"].as_str().unwrap_or("unknown")
                        };

                        return Ok(Some(SeqtaMentionItem {
                            id: format!("assessment-{}", payload["id"].as_i64().unwrap_or(0)),
                            mention_type: MentionType::Assessment,
                            title: payload["title"]
                                .as_str()
                                .unwrap_or("Assessment")
                                .to_string(),
                            subtitle: format!("{} • {}", subject, format_date(due)),
                            data: json!({
                                "id": payload["id"],
                                "title": payload["title"],
                                "subject": subject,
                                "code": payload["code"],
                                "due": due,
                                "dueDate": due,
                                "status": status,
                                "programme": payload.get("programme").or_else(|| payload.get("programmeID")).cloned(),
                                "metaclass": payload.get("metaclass").or_else(|| payload.get("metaID")).cloned(),
                            }),
                            last_updated: Some(chrono::Utc::now().to_rfc3339()),
                        }));
                    }
                }
            }
        }
    }

    if let Some(assignment) = found {
        let due = assignment["due"]
            .as_str()
            .or_else(|| assignment["dueDate"].as_str())
            .unwrap_or("");
        let subject = assignment["subject"]
            .as_str()
            .or_else(|| assignment["code"].as_str())
            .unwrap_or("");

        let due_date = if !due.is_empty() {
            chrono::DateTime::parse_from_rfc3339(due)
                .ok()
                .map(|dt| dt.with_timezone(&chrono::Utc))
                .or_else(|| {
                    chrono::NaiveDateTime::parse_from_str(due, "%Y-%m-%dT%H:%M:%S")
                        .ok()
                        .map(|dt| {
                            chrono::DateTime::<chrono::Utc>::from_naive_utc_and_offset(
                                dt,
                                chrono::Utc,
                            )
                        })
                })
                .or_else(|| {
                    chrono::NaiveDate::parse_from_str(due, "%Y-%m-%d")
                        .ok()
                        .map(|d| {
                            chrono::DateTime::<chrono::Utc>::from_naive_utc_and_offset(
                                d.and_hms_opt(0, 0, 0).unwrap(),
                                chrono::Utc,
                            )
                        })
                })
        } else {
            None
        };

        let status = if let Some(due_dt) = due_date {
            if due_dt > chrono::Utc::now() {
                "pending"
            } else {
                "overdue"
            }
        } else {
            assignment["status"].as_str().unwrap_or("unknown")
        };

        return Ok(Some(SeqtaMentionItem {
            id: format!("assessment-{}", assignment["id"].as_i64().unwrap_or(0)),
            mention_type: MentionType::Assessment,
            title: assignment["title"]
                .as_str()
                .unwrap_or("Assessment")
                .to_string(),
            subtitle: format!("{} • {}", subject, format_date(due)),
            data: json!({
                "id": assignment["id"],
                "title": assignment["title"],
                "subject": subject,
                "code": assignment["code"],
                "due": due,
                "dueDate": due,
                "status": status,
                "programme": assignment.get("programme").or_else(|| assignment.get("programmeID")).cloned(),
                "metaclass": assignment.get("metaclass").or_else(|| assignment.get("metaID")).cloned(),
            }),
            last_updated: Some(chrono::Utc::now().to_rfc3339()),
        }));
    }

    Ok(None)
}

/// Fetch class by ID (programme-metaclass format)
async fn fetch_class_by_id(id: String) -> Result<Option<SeqtaMentionItem>> {
    let body = json!({});
    let headers = HashMap::from([(
        "Content-Type".to_string(),
        "application/json; charset=utf-8".to_string(),
    )]);

    let response = netgrab::fetch_api_data(
        "/seqta/student/load/subjects?",
        netgrab::RequestMethod::POST,
        Some(headers),
        Some(body),
        None,
        false,
        false,
        None,
    )
    .await
    .map_err(|e| anyhow!("Failed to fetch classes: {}", e))?;

    let json_response: Value =
        serde_json::from_str(&response).map_err(|e| anyhow!("Failed to parse response: {}", e))?;

    let folders = json_response["payload"]
        .as_array()
        .map(|v| v.as_slice())
        .unwrap_or(EMPTY_ARRAY);

    let all_subjects: Vec<&Value> = folders
        .iter()
        .flat_map(|folder| {
            folder["subjects"]
                .as_array()
                .map(|v| v.as_slice())
                .unwrap_or(EMPTY_ARRAY)
        })
        .collect();

    let match_subject = all_subjects.iter().find(|s| {
        let p = s["programme"].as_i64();
        let m = s["metaclass"].as_i64();
        if let (Some(p_val), Some(m_val)) = (p, m) {
            format!("{}-{}", p_val, m_val) == id
        } else {
            false
        }
    });

    if let Some(subject) = match_subject {
        let code = subject["code"].as_str().unwrap_or("");
        let programme = subject["programme"].as_i64();
        let metaclass = subject["metaclass"].as_i64();

        // Fetch timetable for next 14 days
        let start = chrono::Utc::now();
        let end = start + chrono::Duration::days(14);
        let from = start.format("%Y-%m-%d").to_string();
        let until = end.format("%Y-%m-%d").to_string();

        let tt_body = json!({
            "from": from,
            "until": until,
            "student": 69
        });

        let mut lessons = Vec::new();
        if let Ok(tt_response) = netgrab::fetch_api_data(
            "/seqta/student/load/timetable?",
            netgrab::RequestMethod::POST,
            Some(HashMap::from([(
                "Content-Type".to_string(),
                "application/json".to_string(),
            )])),
            Some(tt_body),
            None,
            false,
            false,
            None,
        )
        .await
        {
            if let Ok(tt_json) = serde_json::from_str::<Value>(&tt_response) {
                if let Some(items) = tt_json["payload"]["items"].as_array() {
                    for item in items {
                        let meta_ok = metaclass
                            .map(|m| item["metaID"].as_i64().map(|mi| mi == m).unwrap_or(false))
                            .unwrap_or(false);
                        let prog_ok = programme
                            .map(|p| {
                                item["programmeID"]
                                    .as_i64()
                                    .map(|pi| pi == p)
                                    .unwrap_or(false)
                            })
                            .unwrap_or(false);
                        let code_ok = item["code"]
                            .as_str()
                            .map(|c| c.to_lowercase() == code.to_lowercase())
                            .unwrap_or(false);

                        if (meta_ok && prog_ok) || code_ok {
                            let date = item["date"]
                                .as_str()
                                .or_else(|| item["from"].as_str().and_then(|s| s.split('T').next()))
                                .unwrap_or("");
                            let from_time = item["from"]
                                .as_str()
                                .and_then(|s| {
                                    if s.len() >= 5 {
                                        Some(s[..5].to_string())
                                    } else if s.len() >= 16 {
                                        Some(s[11..16].to_string())
                                    } else {
                                        None
                                    }
                                })
                                .unwrap_or_else(|| "".to_string());
                            let until_time = item["until"]
                                .as_str()
                                .and_then(|s| {
                                    if s.len() >= 5 {
                                        Some(s[..5].to_string())
                                    } else if s.len() >= 16 {
                                        Some(s[11..16].to_string())
                                    } else {
                                        None
                                    }
                                })
                                .unwrap_or_else(|| "".to_string());

                            lessons.push(json!({
                                "date": date,
                                "from": from_time,
                                "until": until_time,
                                "room": item["room"].as_str().unwrap_or("TBA"),
                                "teacher": item["staff"].as_str()
                                    .or_else(|| item["teacher"].as_str())
                                    .unwrap_or("")
                            }));
                        }
                    }
                }
            }
        }

        let teacher = subject["teacher"].as_str().unwrap_or("Teacher TBA");

        return Ok(Some(SeqtaMentionItem {
            id: id.clone(),
            mention_type: MentionType::Class,
            title: subject["title"]
                .as_str()
                .or_else(|| subject["code"].as_str())
                .unwrap_or("Class")
                .to_string(),
            subtitle: format!("{} • {}", code, teacher),
            data: json!({
                "id": id,
                "name": subject["title"],
                "code": code,
                "teacher": teacher,
                "programme": programme,
                "metaclass": metaclass,
                "lessons": lessons,
            }),
            last_updated: Some(chrono::Utc::now().to_rfc3339()),
        }));
    }

    Ok(None)
}

/// Fetch subject by ID or code
async fn fetch_subject_by_id(id: String) -> Result<Option<SeqtaMentionItem>> {
    let body = json!({});
    let headers = HashMap::from([(
        "Content-Type".to_string(),
        "application/json; charset=utf-8".to_string(),
    )]);

    let response = netgrab::fetch_api_data(
        "/seqta/student/load/subjects?",
        netgrab::RequestMethod::POST,
        Some(headers),
        Some(body),
        None,
        false,
        false,
        None,
    )
    .await
    .map_err(|e| anyhow!("Failed to fetch subjects: {}", e))?;

    let json_response: Value =
        serde_json::from_str(&response).map_err(|e| anyhow!("Failed to parse response: {}", e))?;

    let folders = json_response["payload"]
        .as_array()
        .map(|v| v.as_slice())
        .unwrap_or(EMPTY_ARRAY);

    let all_subjects: Vec<&Value> = folders
        .iter()
        .flat_map(|folder| {
            folder["subjects"]
                .as_array()
                .map(|v| v.as_slice())
                .unwrap_or(EMPTY_ARRAY)
        })
        .collect();

    let match_subject = all_subjects.iter().find(|s| {
        let p = s["programme"].as_i64();
        let m = s["metaclass"].as_i64();
        let code = s["code"].as_str().unwrap_or("");
        (p.is_some() && m.is_some() && format!("subject-{}-{}", p.unwrap(), m.unwrap()) == id)
            || code == id
    });

    if let Some(subject) = match_subject {
        let code = subject["code"].as_str().unwrap_or("");
        let programme = subject["programme"].as_i64();
        let metaclass = subject["metaclass"].as_i64();
        let teacher = subject["teacher"].as_str().unwrap_or("Teacher TBA");

        return Ok(Some(SeqtaMentionItem {
            id: format!(
                "subject-{}-{}",
                programme.unwrap_or(0),
                metaclass.unwrap_or(0)
            ),
            mention_type: MentionType::Subject,
            title: subject["title"]
                .as_str()
                .or_else(|| subject["code"].as_str())
                .unwrap_or("Subject")
                .to_string(),
            subtitle: format!("{} • {}", code, teacher),
            data: json!({
                "code": code,
                "teacher": teacher,
                "programme": programme,
                "metaclass": metaclass,
            }),
            last_updated: Some(chrono::Utc::now().to_rfc3339()),
        }));
    }

    Ok(None)
}

/// Fetch timetable slot by ID
async fn fetch_timetable_slot_by_id(
    _id: String,
    meta: Option<Value>,
) -> Result<Option<SeqtaMentionItem>> {
    // Extract date/time from meta or ID
    let date = meta
        .as_ref()
        .and_then(|m| m.get("data"))
        .and_then(|d| d.get("date"))
        .and_then(|v| v.as_str());
    let from_time = meta
        .as_ref()
        .and_then(|m| m.get("data"))
        .and_then(|d| d.get("from"))
        .and_then(|v| v.as_str());
    let lesson_id = meta
        .as_ref()
        .and_then(|m| m.get("data"))
        .and_then(|d| d.get("id"))
        .and_then(|v| v.as_i64());

    let start_date = date
        .map(|s| s.to_string())
        .unwrap_or_else(|| chrono::Utc::now().format("%Y-%m-%d").to_string());
    let end_date = date.map(|s| s.to_string()).unwrap_or_else(|| {
        (chrono::Utc::now() + chrono::Duration::days(14))
            .format("%Y-%m-%d")
            .to_string()
    });

    let body = json!({
        "from": start_date,
        "until": end_date,
        "student": 69
    });

    let headers = HashMap::from([("Content-Type".to_string(), "application/json".to_string())]);

    let response = netgrab::fetch_api_data(
        "/seqta/student/load/timetable?",
        netgrab::RequestMethod::POST,
        Some(headers),
        Some(body),
        None,
        false,
        false,
        None,
    )
    .await
    .map_err(|e| anyhow!("Failed to fetch timetable: {}", e))?;

    let json_response: Value =
        serde_json::from_str(&response).map_err(|e| anyhow!("Failed to parse response: {}", e))?;

    let items = json_response["payload"]["items"]
        .as_array()
        .map(|v| v.as_slice())
        .unwrap_or(EMPTY_ARRAY);

    let lesson = items.iter().find(|l| {
        if let Some(lid) = lesson_id {
            l["id"].as_i64().map(|i| i == lid).unwrap_or(false)
        } else if let Some(date_val) = date {
            let lesson_date = l["date"]
                .as_str()
                .or_else(|| l["from"].as_str().and_then(|s| s.split('T').next()))
                .unwrap_or("");
            let lesson_from = l["from"]
                .as_str()
                .and_then(|s| {
                    if s.len() >= 5 {
                        Some(&s[..5])
                    } else if s.len() >= 16 {
                        Some(&s[11..16])
                    } else {
                        None
                    }
                })
                .unwrap_or("");
            lesson_date == date_val && (from_time.is_none() || lesson_from == from_time.unwrap())
        } else {
            false
        }
    });

    if let Some(lesson_val) = lesson {
        let lesson_date = lesson_val["date"]
            .as_str()
            .or_else(|| {
                lesson_val["from"]
                    .as_str()
                    .and_then(|s| s.split('T').next())
            })
            .unwrap_or("");
        let from_time_str = lesson_val["from"]
            .as_str()
            .and_then(|s| {
                if s.len() >= 5 {
                    Some(s[..5].to_string())
                } else if s.len() >= 16 {
                    Some(s[11..16].to_string())
                } else {
                    None
                }
            })
            .unwrap_or_else(|| "".to_string());
        let until_time_str = lesson_val["until"]
            .as_str()
            .and_then(|s| {
                if s.len() >= 5 {
                    Some(s[..5].to_string())
                } else if s.len() >= 16 {
                    Some(s[11..16].to_string())
                } else {
                    None
                }
            })
            .unwrap_or_else(|| "".to_string());

        let code = lesson_val["code"].as_str().unwrap_or("");
        let subject_name = code.to_string(); // Could fetch from subjects API but keeping simple

        return Ok(Some(SeqtaMentionItem {
            id: format!("timetable-slot-{}", lesson_val["id"].as_i64().unwrap_or(0)),
            mention_type: MentionType::TimetableSlot,
            title: format!("{} {}-{}", subject_name, from_time_str, until_time_str),
            subtitle: format!(
                "{} • Room {}",
                lesson_date,
                lesson_val["room"].as_str().unwrap_or("TBA")
            ),
            data: json!({
                "id": lesson_val["id"],
                "date": lesson_date,
                "from": from_time_str,
                "until": until_time_str,
                "code": code,
                "title": lesson_val.get("title").or_else(|| lesson_val.get("description")).cloned(),
                "room": lesson_val["room"].clone(),
                "teacher": lesson_val.get("staff").or_else(|| lesson_val.get("teacher")).cloned(),
                "programme": lesson_val["programmeID"],
                "metaclass": lesson_val["metaID"],
            }),
            last_updated: Some(chrono::Utc::now().to_rfc3339()),
        }));
    }

    Ok(None)
}

/// Fetch notice by ID
async fn fetch_notice_by_id(id: String, meta: Option<Value>) -> Result<Option<SeqtaMentionItem>> {
    let notice_id = id.replace("notice-", "");
    let date_str = meta
        .as_ref()
        .and_then(|m| m.get("data"))
        .and_then(|d| d.get("date"))
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .unwrap_or_else(|| chrono::Utc::now().format("%Y-%m-%d").to_string());
    let date = date_str.as_str();

    let body = json!({ "date": date });
    let headers = HashMap::from([("Content-Type".to_string(), "application/json".to_string())]);

    let response = netgrab::fetch_api_data(
        "/seqta/student/load/notices?",
        netgrab::RequestMethod::POST,
        Some(headers),
        Some(body),
        None,
        false,
        false,
        None,
    )
    .await
    .map_err(|e| anyhow!("Failed to fetch notices: {}", e))?;

    let json_response: Value =
        serde_json::from_str(&response).map_err(|e| anyhow!("Failed to parse response: {}", e))?;

    let notices = json_response["payload"]
        .as_array()
        .map(|v| v.as_slice())
        .unwrap_or(EMPTY_ARRAY);

    let notice = notices.iter().enumerate().find(|(i, n)| {
        n["id"]
            .as_i64()
            .map(|ni| ni.to_string() == notice_id)
            .unwrap_or(false)
            || (i + 1).to_string() == notice_id
            || i.to_string() == notice_id
    });

    if let Some((_, notice_val)) = notice {
        return Ok(Some(SeqtaMentionItem {
            id: format!("notice-{}", notice_val["id"].as_i64().unwrap_or(0)),
            mention_type: MentionType::Notice,
            title: notice_val["title"].as_str().unwrap_or("Notice").to_string(),
            subtitle: format!(
                "{} • {}",
                notice_val["label_title"].as_str().unwrap_or("Notice"),
                notice_val["staff"].as_str().unwrap_or("Staff")
            ),
            data: json!({
                "id": notice_val["id"],
                "title": notice_val["title"],
                "subtitle": notice_val["label_title"],
                "author": notice_val["staff"],
                "color": notice_val["colour"],
                "labelId": notice_val["label"],
                "content": notice_val["contents"],
                "date": date,
            }),
            last_updated: Some(chrono::Utc::now().to_rfc3339()),
        }));
    }

    Ok(None)
}

/// Fetch homework by ID
async fn fetch_homework_by_id(
    id: String,
    _meta: Option<Value>,
) -> Result<Option<SeqtaMentionItem>> {
    let homework_id = id.replace("homework-", "");

    let body = json!({});
    let mut params = HashMap::new();
    params.insert("majhvjju".to_string(), "".to_string());

    let headers = HashMap::from([("Content-Type".to_string(), "application/json".to_string())]);

    let response = netgrab::fetch_api_data(
        "/seqta/student/dashlet/summary/homework",
        netgrab::RequestMethod::POST,
        Some(headers),
        Some(body),
        Some(params),
        false,
        false,
        None,
    )
    .await
    .map_err(|e| anyhow!("Failed to fetch homework: {}", e))?;

    let json_response: Value =
        serde_json::from_str(&response).map_err(|e| anyhow!("Failed to parse response: {}", e))?;

    let homework_items = json_response["payload"]
        .as_array()
        .map(|v| v.as_slice())
        .unwrap_or(EMPTY_ARRAY);

    let homework = homework_items.iter().find(|h| {
        h["id"]
            .as_i64()
            .map(|hi| hi.to_string() == homework_id)
            .unwrap_or(false)
            || h["meta"]
                .as_i64()
                .map(|m| m.to_string() == homework_id)
                .unwrap_or(false)
    });

    if let Some(hw) = homework {
        let items = hw["items"]
            .as_array()
            .map(|v| v.as_slice())
            .unwrap_or(EMPTY_ARRAY);
        let item_count = items.len();

        return Ok(Some(SeqtaMentionItem {
            id: format!(
                "homework-{}",
                hw["id"]
                    .as_i64()
                    .or_else(|| hw["meta"].as_i64())
                    .unwrap_or(0)
            ),
            mention_type: MentionType::Homework,
            title: hw["title"].as_str().unwrap_or("Homework").to_string(),
            subtitle: format!(
                "{} {}",
                item_count,
                if item_count == 1 { "item" } else { "items" }
            ),
            data: json!({
                "id": hw["id"],
                "meta": hw["meta"],
                "title": hw["title"],
                "items": items,
            }),
            last_updated: Some(chrono::Utc::now().to_rfc3339()),
        }));
    }

    Ok(None)
}

/// Fetch teacher by ID
async fn fetch_teacher_by_id(id: String, _meta: Option<Value>) -> Result<Option<SeqtaMentionItem>> {
    let teacher_id = id.replace("teacher-", "");

    let body = json!({ "mode": "staff" });
    let headers = HashMap::from([("Content-Type".to_string(), "application/json".to_string())]);

    let response = netgrab::fetch_api_data(
        "/seqta/student/load/message/people",
        netgrab::RequestMethod::POST,
        Some(headers),
        Some(body),
        None,
        false,
        false,
        None,
    )
    .await
    .map_err(|e| anyhow!("Failed to fetch staff: {}", e))?;

    let json_response: Value = if response.starts_with('{') {
        serde_json::from_str(&response).map_err(|e| anyhow!("Failed to parse response: {}", e))?
    } else {
        json!({})
    };

    let staff = json_response["payload"]
        .as_array()
        .map(|v| v.as_slice())
        .unwrap_or(EMPTY_ARRAY);

    let teacher = staff.iter().find(|t| {
        t["id"]
            .as_i64()
            .map(|ti| ti.to_string() == teacher_id)
            .unwrap_or(false)
    });

    if let Some(t) = teacher {
        let display_name = t["xx_display"]
            .as_str()
            .map(|s| s.to_string())
            .or_else(|| {
                let first = t["firstname"].as_str().unwrap_or("");
                let last = t["surname"].as_str().unwrap_or("");
                if !first.is_empty() || !last.is_empty() {
                    Some(format!("{} {}", first, last).trim().to_string())
                } else {
                    None
                }
            })
            .unwrap_or_else(|| "Teacher".to_string());

        return Ok(Some(SeqtaMentionItem {
            id: format!("teacher-{}", t["id"].as_i64().unwrap_or(0)),
            mention_type: MentionType::Teacher,
            title: display_name,
            subtitle: "Staff".to_string(),
            data: json!({
                "id": t["id"],
                "firstname": t["firstname"],
                "surname": t["surname"],
                "displayName": t["xx_display"],
            }),
            last_updated: Some(chrono::Utc::now().to_rfc3339()),
        }));
    }

    Ok(None)
}

/// Fetch timetable by date
async fn fetch_timetable_by_id(
    id: String,
    meta: Option<Value>,
) -> Result<Option<SeqtaMentionItem>> {
    let date_str = id.replace("timetable-", "");
    let date = if date_str.is_empty() {
        meta.as_ref()
            .and_then(|m| m.get("data"))
            .and_then(|d| d.get("date"))
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
            .unwrap_or_else(|| chrono::Utc::now().format("%Y-%m-%d").to_string())
    } else {
        date_str
    };

    let body = json!({
        "from": date.as_str(),
        "until": date.as_str(),
        "student": 69
    });

    let headers = HashMap::from([("Content-Type".to_string(), "application/json".to_string())]);

    let response = netgrab::fetch_api_data(
        "/seqta/student/load/timetable?",
        netgrab::RequestMethod::POST,
        Some(headers),
        Some(body),
        None,
        false,
        false,
        None,
    )
    .await
    .map_err(|e| anyhow!("Failed to fetch timetable: {}", e))?;

    let json_response: Value =
        serde_json::from_str(&response).map_err(|e| anyhow!("Failed to parse response: {}", e))?;

    let items = json_response["payload"]["items"]
        .as_array()
        .map(|v| v.as_slice())
        .unwrap_or(EMPTY_ARRAY);

    let classes: Vec<Value> = items
        .iter()
        .map(|lesson| {
            let subject = lesson
                .get("title")
                .or_else(|| lesson.get("code"))
                .cloned()
                .unwrap_or(json!(""));
            let teacher = lesson
                .get("staff")
                .or_else(|| lesson.get("teacher"))
                .cloned()
                .unwrap_or(json!(""));
            json!({
                "subject": subject,
                "time": format!("{} - {}",
                    lesson["from"].as_str()
                        .and_then(|s| if s.len() >= 5 { Some(&s[..5]) } else { None })
                        .unwrap_or(""),
                    lesson["until"].as_str()
                        .and_then(|s| if s.len() >= 5 { Some(&s[..5]) } else { None })
                        .unwrap_or("")
                ),
                "room": lesson["room"].as_str().unwrap_or("TBA"),
                "teacher": teacher,
            })
        })
        .collect();

    Ok(Some(SeqtaMentionItem {
        id: format!("timetable-{}", date),
        mention_type: MentionType::Timetable,
        title: "Today's Schedule".to_string(),
        subtitle: format!("{} classes scheduled", items.len()),
        data: json!({
            "id": format!("timetable-{}", date),
            "date": date,
            "classes": classes,
        }),
        last_updated: Some(chrono::Utc::now().to_rfc3339()),
    }))
}

/// Update mention data - main entry point
pub async fn update_mention_data(
    mention_id: String,
    mention_type: String,
    meta: Option<Value>,
) -> Result<Option<SeqtaMentionItem>> {
    // Normalize ID for classes
    let mut normalized_id = mention_id.clone();
    if mention_type == "class" {
        normalized_id = normalized_id.replace("class:", "");
    }

    match mention_type.as_str() {
        "assignment" | "assessment" => {
            let clean_id = meta
                .as_ref()
                .and_then(|m| m.get("lookup"))
                .and_then(|l| l.get("id"))
                .and_then(|v| v.as_str())
                .or_else(|| Some(normalized_id.as_str()))
                .unwrap_or("");
            let clean_id_str = clean_id
                .replace("assessment-", "")
                .replace("assignment-", "");
            fetch_assignment_by_id(clean_id_str, meta).await
        }
        "class" => {
            let class_id = meta
                .as_ref()
                .and_then(|m| m.get("lookup"))
                .and_then(|l| {
                    let p = l.get("programme")?.as_i64()?;
                    let m = l.get("metaclass")?.as_i64()?;
                    Some(format!("{}-{}", p, m))
                })
                .unwrap_or_else(|| normalized_id);
            fetch_class_by_id(class_id).await
        }
        "subject" => {
            let subject_id = meta
                .as_ref()
                .and_then(|m| m.get("lookup"))
                .and_then(|l| l.get("code"))
                .and_then(|v| v.as_str())
                .map(|s| s.to_string())
                .unwrap_or_else(|| normalized_id);
            fetch_subject_by_id(subject_id).await
        }
        "timetable_slot" => fetch_timetable_slot_by_id(normalized_id, meta).await,
        "timetable" => fetch_timetable_by_id(normalized_id, meta).await,
        "notice" => fetch_notice_by_id(normalized_id, meta).await,
        "homework" => fetch_homework_by_id(normalized_id, meta).await,
        "teacher" => fetch_teacher_by_id(normalized_id, meta).await,
        _ => Ok(None),
    }
}

/// Tauri command: Search mentions
#[tauri::command]
pub async fn search_seqta_mentions(
    query: String,
    category_filter: Option<String>,
) -> Result<Vec<SeqtaMentionItem>, String> {
    search_mentions(query, category_filter)
        .await
        .map_err(|e| e.to_string())
}

/// Tauri command: Search mentions with context
#[tauri::command]
pub async fn search_seqta_mentions_with_context(
    query: String,
    note_content: String,
    category_filter: Option<String>,
) -> Result<Vec<SeqtaMentionItem>, String> {
    search_mentions_with_context(query, note_content, category_filter)
        .await
        .map_err(|e| e.to_string())
}

/// Tauri command: Update mention data
#[tauri::command]
pub async fn update_seqta_mention_data(
    mention_id: String,
    mention_type: String,
    meta: Option<Value>,
) -> Result<Option<SeqtaMentionItem>, String> {
    update_mention_data(mention_id, mention_type, meta)
        .await
        .map_err(|e| e.to_string())
}

/// Get weekly schedule for a class
pub async fn get_weekly_schedule_for_class(
    programme: Option<i64>,
    metaclass: Option<i64>,
    code: Option<String>,
) -> Result<Vec<serde_json::Map<String, Value>>, String> {
    let student_id = 69; // TODO: Get from session
    let mut collected: Vec<serde_json::Map<String, Value>> = Vec::new();

    // Go back 6 steps (~2 months each, up to ~1 year)
    for i in 0..6 {
        let anchor = chrono::Utc::now() - chrono::Duration::days(i * 60);
        let day = anchor.weekday().num_days_from_sunday();

        // Find Monday of the anchor week
        let delta_to_monday = if day == 0 { -6 } else { 1 - day as i64 };
        let monday = anchor + chrono::Duration::days(delta_to_monday);
        let friday = monday + chrono::Duration::days(4);

        let from = monday.format("%Y-%m-%d").to_string();
        let until = friday.format("%Y-%m-%d").to_string();

        let body = json!({
            "from": from,
            "until": until,
            "student": student_id
        });

        let headers = HashMap::from([("Content-Type".to_string(), "application/json".to_string())]);

        if let Ok(response) = netgrab::fetch_api_data(
            "/seqta/student/load/timetable?",
            netgrab::RequestMethod::POST,
            Some(headers),
            Some(body),
            None,
            false,
            false,
            None,
        )
        .await
        {
            if let Ok(json_response) = serde_json::from_str::<Value>(&response) {
                if let Some(items) = json_response["payload"]["items"].as_array() {
                    for item in items {
                        let meta_ok = metaclass
                            .map(|m| item["metaID"].as_i64().map(|mi| mi == m).unwrap_or(false))
                            .unwrap_or(false);
                        let prog_ok = programme
                            .map(|p| {
                                item["programmeID"]
                                    .as_i64()
                                    .map(|pi| pi == p)
                                    .unwrap_or(false)
                            })
                            .unwrap_or(false);
                        let code_ok = code
                            .as_ref()
                            .map(|c| {
                                item["code"]
                                    .as_str()
                                    .map(|ic| ic.to_lowercase() == c.to_lowercase())
                                    .unwrap_or(false)
                            })
                            .unwrap_or(false);

                        if (meta_ok && prog_ok) || code_ok {
                            let date = item["date"]
                                .as_str()
                                .or_else(|| item["from"].as_str().and_then(|s| s.split('T').next()))
                                .unwrap_or("");
                            let from_time = item["from"]
                                .as_str()
                                .and_then(|s| {
                                    if s.len() >= 5 {
                                        Some(s[..5].to_string())
                                    } else if s.len() >= 16 {
                                        Some(s[11..16].to_string())
                                    } else {
                                        None
                                    }
                                })
                                .unwrap_or_else(|| "".to_string());
                            let until_time = item["until"]
                                .as_str()
                                .and_then(|s| {
                                    if s.len() >= 5 {
                                        Some(s[..5].to_string())
                                    } else if s.len() >= 16 {
                                        Some(s[11..16].to_string())
                                    } else {
                                        None
                                    }
                                })
                                .unwrap_or_else(|| "".to_string());

                            let mut entry = serde_json::Map::new();
                            entry.insert("date".to_string(), json!(date));
                            entry.insert("from".to_string(), json!(from_time));
                            entry.insert("until".to_string(), json!(until_time));
                            if let Some(room) = item["room"].as_str() {
                                entry.insert("room".to_string(), json!(room));
                            }
                            collected.push(entry);
                        }
                    }
                }
            }
        }
    }

    // Deduplicate by weekday and time range
    let mut seen = std::collections::HashSet::new();
    let mut deduped = Vec::new();

    for entry in collected {
        if let (Some(date_val), Some(from_val), Some(until_val)) = (
            entry.get("date").and_then(|v| v.as_str()),
            entry.get("from").and_then(|v| v.as_str()),
            entry.get("until").and_then(|v| v.as_str()),
        ) {
            if let Ok(d) = chrono::NaiveDate::parse_from_str(date_val, "%Y-%m-%d") {
                let weekday = d.weekday();
                let weekday_str = match weekday {
                    chrono::Weekday::Mon => "Mon",
                    chrono::Weekday::Tue => "Tue",
                    chrono::Weekday::Wed => "Wed",
                    chrono::Weekday::Thu => "Thu",
                    chrono::Weekday::Fri => "Fri",
                    chrono::Weekday::Sat => "Sat",
                    chrono::Weekday::Sun => "Sun",
                };

                if weekday_str == "Sat" || weekday_str == "Sun" {
                    continue; // Skip weekends
                }

                let room = entry.get("room").and_then(|v| v.as_str()).unwrap_or("");
                let sig = format!("{}-{}-{}-{}", weekday_str, from_val, until_val, room);

                if !seen.contains(&sig) {
                    seen.insert(sig);
                    deduped.push(entry);
                }
            }
        }
    }

    Ok(deduped)
}

/// Fetch lesson content for a class
pub async fn fetch_lesson_content(
    programme: i64,
    metaclass: i64,
    lesson_index: Option<usize>,
    term_index: Option<usize>,
) -> Result<Option<Value>, String> {
    let body = json!({
        "programme": programme.to_string(),
        "metaclass": metaclass.to_string(),
    });

    let headers = HashMap::from([(
        "Content-Type".to_string(),
        "application/json; charset=utf-8".to_string(),
    )]);

    let response = netgrab::fetch_api_data(
        "/seqta/student/load/courses",
        netgrab::RequestMethod::POST,
        Some(headers),
        Some(body),
        None,
        false,
        false,
        None,
    )
    .await
    .map_err(|e| format!("Failed to fetch lesson content: {}", e))?;

    let json_response: Value =
        serde_json::from_str(&response).map_err(|e| format!("Failed to parse response: {}", e))?;

    let course_payload = json_response.get("payload");
    if let Some(w) = course_payload.and_then(|p| p.get("w")) {
        // If lessonIndex and termIndex provided, return specific lesson
        if let (Some(li), Some(ti)) = (lesson_index, term_index) {
            if let Some(term) = w.as_array().and_then(|terms| terms.get(ti)) {
                if let Some(lesson) = term.as_array().and_then(|lessons| lessons.get(li)) {
                    return Ok(Some(lesson.clone()));
                }
            }
            return Ok(None);
        }

        // Otherwise return all lessons
        return Ok(Some(w.clone()));
    }

    Ok(None)
}

/// Tauri command: Get weekly schedule for class
#[tauri::command]
pub async fn get_weekly_schedule_for_class_cmd(
    programme: Option<i64>,
    metaclass: Option<i64>,
    code: Option<String>,
) -> Result<Vec<serde_json::Map<String, Value>>, String> {
    get_weekly_schedule_for_class(programme, metaclass, code).await
}

/// Tauri command: Fetch lesson content
#[tauri::command]
pub async fn fetch_lesson_content_cmd(
    programme: i64,
    metaclass: i64,
    lesson_index: Option<usize>,
    term_index: Option<usize>,
) -> Result<Option<Value>, String> {
    fetch_lesson_content(programme, metaclass, lesson_index, term_index).await
}
