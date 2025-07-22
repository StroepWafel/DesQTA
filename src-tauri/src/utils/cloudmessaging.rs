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

// Suppress non_snake_case warnings for compatibility with frontend naming
#[allow(non_snake_case)]
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Message {
    pub id: i32,
    pub senderId: i32,
    pub receiverId: i32,
    pub content: String,
    pub read: bool,
    pub createdAt: String,
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
pub async fn send_message(token: String, receiver_id: i32, content: String) -> Result<Message, String> {
    let client = get_auth_client(&token).await;
    let url = format!("{}/api/messages", BASE_URL);
    let body = serde_json::json!({
        "receiverId": receiver_id,
        "content": content
    });
    let resp = client.post(&url).json(&body).send().await.map_err(|e| e.to_string())?;
    if !resp.status().is_success() {
        return Err(format!("Failed to send message: {}", resp.status()));
    }
    let msg = resp.json::<Message>().await.map_err(|e| e.to_string())?;
    Ok(msg)
}

// Suppress non_snake_case warning for function parameter
#[allow(non_snake_case)]
#[tauri::command]
pub async fn get_messages(token: String, userId: i32) -> Result<Vec<Message>, String> {
    let client = get_auth_client(&token).await;
    let url = format!("{}/api/messages/{}", BASE_URL, userId);
    let resp = client.get(&url).send().await.map_err(|e| e.to_string())?;
    if !resp.status().is_success() {
        return Err(format!("Failed to fetch messages: {}", resp.status()));
    }
    let raw = resp.text().await.map_err(|e| e.to_string())?;
    let messages = serde_json::from_str::<Vec<Message>>(&raw).map_err(|e| format!("Failed to decode messages: {}\nRaw: {}", e, raw))?;
    Ok(messages)
} 