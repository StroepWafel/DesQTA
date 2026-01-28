use super::netgrab;
use super::netgrab::RequestMethod;
use crate::logger;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Message {
    pub id: i64,
    pub folder: String,
    pub sender: String,
    #[serde(rename = "senderPhoto")]
    pub sender_photo: Option<String>,
    pub to: String,
    pub subject: String,
    pub preview: String,
    pub body: String,
    pub date: String,
    pub unread: bool,
    pub starred: bool,
}

fn parse_message_json(msg: &Value, folder_label: &str) -> Option<Message> {
    let id = msg.get("id")?.as_i64()?;
    let subject = msg
        .get("subject")
        .and_then(|v| v.as_str())
        .unwrap_or("(No Subject)")
        .to_string();
    let sender = msg
        .get("sender")
        .and_then(|v| v.as_str())
        .unwrap_or("Unknown")
        .to_string();
    let sender_photo = msg
        .get("sender_photo")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    let participants = msg.get("participants").and_then(|v| v.as_array());
    let to = if let Some(parts) = participants {
        if let Some(first) = parts.first() {
            first
                .get("name")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string()
        } else {
            "".to_string()
        }
    } else {
        "".to_string()
    };

    let attachments = msg
        .get("attachments")
        .and_then(|v| v.as_array())
        .map(|a| !a.is_empty())
        .unwrap_or(false);
    let preview = format!(
        "{}{}",
        subject,
        if attachments { " (Attachment)" } else { "" }
    );

    let date_raw = msg.get("date").and_then(|v| v.as_str()).unwrap_or("");
    // Format: "2023-10-27T10:30:00" -> "2023-10-27 10:30"
    let date = date_raw.replace("T", " ").chars().take(16).collect();

    let read = msg.get("read").and_then(|v| v.as_bool()).unwrap_or(true); // Default to read if missing
    let starred = msg
        .get("starred")
        .and_then(|v| v.as_bool())
        .unwrap_or(false);

    // Capitalize folder label for display
    let folder_display = if folder_label.len() > 0 {
        let mut c = folder_label.chars();
        match c.next() {
            None => String::new(),
            Some(f) => f.to_uppercase().collect::<String>() + c.as_str(),
        }
    } else {
        folder_label.to_string()
    };

    Some(Message {
        id,
        folder: folder_display,
        sender,
        sender_photo,
        to,
        subject,
        preview,
        body: "".to_string(), // Body loaded separately
        date,
        unread: !read,
        starred,
    })
}

#[tauri::command]
pub async fn fetch_messages(
    folder: String,
    rss_url: Option<String>,
) -> Result<Vec<Message>, String> {
    if let Some(logger) = logger::get_logger() {
        let _ = logger.log(
            logger::LogLevel::INFO,
            "messages",
            "fetch_messages",
            &format!("Fetching messages for folder: {}", folder),
            json!({ "folder": folder, "rss": rss_url }),
        );
    }

    if folder == "sent" {
        // Fetch both sent and outbox in parallel
        // Force "Sent" as the folder name for UI consistency, merging sent/outbox
        let sent_future = fetch_seqta_messages("sent", Some("Sent"));
        let outbox_future = fetch_seqta_messages("outbox", Some("Sent"));

        let (sent_res, outbox_res) = tokio::join!(sent_future, outbox_future);

        let mut messages = Vec::new();
        if let Ok(sent) = sent_res {
            messages.extend(sent);
        }
        if let Ok(outbox) = outbox_res {
            messages.extend(outbox);
        }

        // Sort by date descending
        messages.sort_by(|a, b| b.date.cmp(&a.date));

        Ok(messages)
    } else if folder.starts_with("rss-") {
        // Handle RSS feeds
        // For now, if rss_url is provided or embedded in folder name, fetch it
        // The frontend passes `rssname` as `rss_url` (which is actually the name/title),
        // and `folder` as the ID e.g., "rss-http://..."

        let url = folder.trim_start_matches("rss-");
        match netgrab::get_rss_feed(url).await {
            Ok(json_val) => {
                let channel_title = json_val
                    .get("channel")
                    .and_then(|c| c.get("title"))
                    .and_then(|t| t.get("text").or(Some(t)))
                    .and_then(|t| t.as_str())
                    .unwrap_or("RSS Feed");

                let items = json_val.get("feeds").and_then(|v| v.as_array());
                let mut messages = Vec::new();

                if let Some(items) = items {
                    for (i, item) in items.iter().enumerate() {
                        let title = item
                            .get("title")
                            .and_then(|t| t.get("text").or(Some(t)))
                            .and_then(|v| v.as_str())
                            .unwrap_or("No Title");
                        let link = item
                            .get("link")
                            .and_then(|t| t.get("text").or(Some(t)))
                            .and_then(|v| v.as_str())
                            .unwrap_or("");
                        let description = item
                            .get("description")
                            .and_then(|t| t.get("text").or(Some(t)))
                            .and_then(|v| v.as_str())
                            .unwrap_or("No description");
                        let pub_date = item
                            .get("pubDate")
                            .and_then(|t| t.get("text").or(Some(t)))
                            .and_then(|v| v.as_str())
                            .unwrap_or("");

                        // Try to parse date, otherwise use raw
                        // RSS dates are usually RFC2822: "Tue, 10 Jun 2003 04:00:00 GMT"
                        // We want "YYYY-MM-DD HH:mm:ss" for sorting
                        let date_formatted = match chrono::DateTime::parse_from_rfc2822(pub_date) {
                            Ok(dt) => dt.format("%Y-%m-%d %H:%M:%S").to_string(),
                            Err(_) => pub_date.to_string(), // Fallback
                        };

                        let body = format!(
                            r#"<a href="{}" target="_blank">View the RSS feed link.</a><br><br>{}"#,
                            link, description
                        );

                        messages.push(Message {
                            id: (i as i64) + 1000000, // Fake ID
                            folder: rss_url.clone().unwrap_or_else(|| channel_title.to_string()),
                            sender: channel_title.to_string(),
                            sender_photo: None,
                            to: "".to_string(),
                            subject: title.to_string(),
                            preview: format!("{} from {}", title, channel_title),
                            body,
                            date: date_formatted,
                            unread: false,
                            starred: false,
                        });
                    }
                }
                // Sort by date descending
                messages.sort_by(|a, b| b.date.cmp(&a.date));
                Ok(messages)
            }
            Err(e) => Err(format!("Failed to fetch RSS feed: {}", e)),
        }
    } else {
        // Regular folder
        let msgs = fetch_seqta_messages(&folder, None).await?;
        Ok(msgs)
    }
}

async fn fetch_seqta_messages(
    label: &str,
    folder_override: Option<&str>,
) -> Result<Vec<Message>, String> {
    let body = json!({
        "searchValue": "",
        "sortBy": "date",
        "sortOrder": "desc",
        "action": "list",
        "label": label,
        "offset": 0,
        "limit": 100,
        "datetimeUntil": null,
    });

    let response = netgrab::fetch_api_data(
        "/seqta/student/load/message?",
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

    let data: Value =
        serde_json::from_str(&response).map_err(|e| format!("Failed to parse response: {}", e))?;

    let mut messages = Vec::new();
    let folder_name = folder_override.unwrap_or(label);

    if let Some(msgs_array) = data
        .get("payload")
        .and_then(|p| p.get("messages"))
        .and_then(|m| m.as_array())
    {
        for msg_val in msgs_array {
            if let Some(msg) = parse_message_json(msg_val, folder_name) {
                messages.push(msg);
            }
        }
    }

    Ok(messages)
}

#[tauri::command]
pub async fn fetch_message_content(id: i64) -> Result<String, String> {
    let body = json!({
        "action": "message",
        "id": id,
    });

    let response = netgrab::fetch_api_data(
        "/seqta/student/load/message?",
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

    let data: Value =
        serde_json::from_str(&response).map_err(|e| format!("Failed to parse response: {}", e))?;

    let content = data
        .get("payload")
        .and_then(|p| p.get("contents"))
        .and_then(|c| c.as_str())
        .unwrap_or("No content")
        .to_string();

    Ok(content)
}

#[tauri::command]
pub async fn star_messages(items: Vec<i64>, star: bool) -> Result<(), String> {
    let body = json!({
        "mode": "x-star",
        "starred": star,
        "items": items,
    });

    let _ = netgrab::fetch_api_data(
        "/seqta/student/save/message?",
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

    Ok(())
}

#[tauri::command]
pub async fn delete_messages(items: Vec<i64>) -> Result<(), String> {
    let body = json!({
        "mode": "x-label",
        "label": "trash",
        "items": items,
    });

    let _ = netgrab::fetch_api_data(
        "/seqta/student/save/message?",
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

    Ok(())
}

#[tauri::command]
pub async fn restore_messages(items: Vec<i64>) -> Result<(), String> {
    let body = json!({
        "mode": "x-label",
        "label": "inbox",
        "items": items,
    });

    let _ = netgrab::fetch_api_data(
        "/seqta/student/save/message?",
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

    Ok(())
}
