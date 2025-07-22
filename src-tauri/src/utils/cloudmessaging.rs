use serde::{Deserialize, Serialize};
use reqwest::Client;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Friend {
    pub id: i32,
    pub username: String,
    #[serde(default)]
    #[serde(rename = "displayName")]
    pub display_name: Option<String>,
    #[serde(default)]
    #[serde(rename = "pfpUrl")]
    pub pfp_url: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GroupMember {
    pub id: i32,
    #[serde(default)]
    #[serde(rename = "displayName")]
    pub display_name: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Group {
    pub id: i32,
    pub name: String,
    #[serde(default)]
    pub iconUrl: Option<String>,
    pub members: Vec<GroupMember>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Attachment {
    pub id: Option<i32>,
    pub filename: Option<String>,
    pub storedName: Option<String>,
    pub mimeType: Option<String>,
    pub size: Option<i64>,
    pub url: Option<String>,
    pub isPublic: Option<bool>,
    pub createdAt: Option<String>,
    pub userId: Option<i32>,
    pub path: Option<String>,
    pub updatedAt: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MessageReply {
    pub id: i32,
    pub content: String,
}

// Suppress non_snake_case warnings for compatibility with frontend naming
#[allow(non_snake_case)]
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Message {
    pub id: i32,
    pub senderId: i32,
    pub receiverId: Option<i32>,
    pub groupId: Option<i32>,
    pub content: String,
    pub read: bool,
    pub createdAt: String,
    pub replyToId: Option<i32>,
    pub replyTo: Option<MessageReply>,
    pub attachmentId: Option<i32>,
    pub attachment: Option<Attachment>,
    pub sender: Option<Friend>,
    pub receiver: Option<Friend>,
}

const BASE_URL: &str = "http://smb.adenmgb.com:100"; // Change if needed

async fn get_auth_client(token: &str) -> Client {
    let mut headers = reqwest::header::HeaderMap::new();
    headers.insert(
        reqwest::header::AUTHORIZATION,
        format!("Bearer {}", token).parse().unwrap(),
    );
    headers.insert(
        reqwest::header::CONTENT_TYPE,
        "application/json".parse().unwrap(),
    );
    Client::builder()
        .default_headers(headers)
        .build()
        .unwrap()
}

#[tauri::command]
pub async fn get_friends(token: String) -> Result<Vec<Friend>, String> {
    let client = get_auth_client(&token).await;
    let url = format!("{}/api/friends", BASE_URL);
    let resp = client.get(&url).send().await.map_err(|e| e.to_string())?;
    if !resp.status().is_success() {
        return Err(format!("Failed to fetch friends: {}", resp.status()));
    }
    let friends = resp.json::<Vec<Friend>>().await.map_err(|e| e.to_string())?;
    Ok(friends)
}

#[tauri::command]
pub async fn list_groups(token: String) -> Result<Vec<Group>, String> {
    let client = get_auth_client(&token).await;
    let url = format!("{}/api/messages", BASE_URL);
    let resp = client.get(&url).send().await.map_err(|e| e.to_string())?;
    if !resp.status().is_success() {
        return Err(format!("Failed to fetch groups: {}", resp.status()));
    }
    let groups = resp.json::<Vec<Group>>().await.map_err(|e| e.to_string())?;
    Ok(groups)
}

#[tauri::command]
pub async fn create_group(token: String, name: String, member_ids: Vec<i32>) -> Result<Group, String> {
    let client = get_auth_client(&token).await;
    let url = format!("{}/api/messages/create-group", BASE_URL);
    let body = serde_json::json!({
        "name": name,
        "memberIds": member_ids
    });
    let resp = client.post(&url).json(&body).send().await.map_err(|e| e.to_string())?;
    if !resp.status().is_success() {
        return Err(format!("Failed to create group: {}", resp.status()));
    }
    let group = resp.json::<Group>().await.map_err(|e| e.to_string())?;
    Ok(group)
}

#[tauri::command]
pub async fn send_message(
    token: String,
    receiver_id: Option<i32>,
    group_id: Option<i32>,
    content: String,
    reply_to_id: Option<i32>,
    attachment_id: Option<i32>,
) -> Result<Message, String> {
    let client = get_auth_client(&token).await;
    let url = format!("{}/api/messages", BASE_URL);
    let mut body = serde_json::Map::new();
    body.insert("content".to_string(), serde_json::json!(content));
    if let Some(rid) = receiver_id { body.insert("receiverId".to_string(), serde_json::json!(rid)); }
    if let Some(gid) = group_id { body.insert("groupId".to_string(), serde_json::json!(gid)); }
    if let Some(rid) = reply_to_id { body.insert("replyToId".to_string(), serde_json::json!(rid)); }
    if let Some(aid) = attachment_id { body.insert("attachmentId".to_string(), serde_json::json!(aid)); }
    let resp = client.post(&url).json(&body).send().await.map_err(|e| e.to_string())?;
    let status = resp.status();
    let resp_text = resp.text().await.unwrap_or_else(|_| "<Failed to read response body>".to_string());
    if !status.is_success() {
        return Err(format!("Failed to send message: {}\nBody: {}", status, resp_text));
    }
    let mut msg: Message = serde_json::from_str(&resp_text).map_err(|e| e.to_string())?;
    if msg.receiverId.is_none() { msg.receiverId = receiver_id; }
    if msg.groupId.is_none() { msg.groupId = group_id; }
    if msg.replyToId.is_none() { msg.replyToId = reply_to_id; }
    if msg.attachmentId.is_none() { msg.attachmentId = attachment_id; }
    Ok(msg)
}

// Suppress non_snake_case warning for function parameter
#[allow(non_snake_case)]
#[tauri::command]
pub async fn get_messages(token: String, id: i32) -> Result<Vec<Message>, String> {
    let client = get_auth_client(&token).await;
    let url = format!("{}/api/messages/{}", BASE_URL, id);
    let resp = client.get(&url).send().await.map_err(|e| e.to_string())?;
    if !resp.status().is_success() {
        return Err(format!("Failed to fetch messages: {}", resp.status()));
    }
    let raw = resp.text().await.map_err(|e| e.to_string())?;
    let messages = serde_json::from_str::<Vec<Message>>(&raw).map_err(|e| format!("Failed to decode messages: {}\nRaw: {}", e, raw))?;
    Ok(messages)
}

// (Optional) Stub for file upload endpoint
#[tauri::command]
pub async fn upload_attachment(token: String, file_path: String) -> Result<Attachment, String> {
    // TODO: Implement file upload using multipart/form-data
    Err("Not implemented yet".to_string())
} 