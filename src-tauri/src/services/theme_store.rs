use crate::netgrab;
use serde_json::{json, Value};
use std::collections::HashMap;
use std::time::Duration;

const DEFAULT_API_BASE_URL: &str = "https://betterseqta.org/api/themes";
const REQUEST_TIMEOUT: Duration = Duration::from_secs(30);

/// Get the API base URL, checking for dev override from settings
fn get_api_base_url() -> String {
    // TODO: Could read from settings if we want to persist dev URL
    // For now, we'll pass it from the frontend
    DEFAULT_API_BASE_URL.to_string()
}

/// Make a request to the theme store API
async fn make_request(
    endpoint: String,
    method: &str,
    headers: Option<HashMap<String, String>>,
    body: Option<Value>,
    base_url: Option<String>,
) -> Result<Value, String> {
    let api_base = base_url.unwrap_or_else(get_api_base_url);
    
    // Ensure endpoint starts with /
    let endpoint = if endpoint.starts_with('/') {
        endpoint
    } else {
        format!("/{}", endpoint)
    };
    
    let url = if api_base.ends_with("/api/themes") {
        format!("{}{}", api_base, endpoint)
    } else if api_base.ends_with("/api/themes/") {
        format!("{}{}", api_base.trim_end_matches('/'), endpoint)
    } else {
        format!("{}/api/themes{}", api_base.trim_end_matches('/'), endpoint)
    };

    let client = netgrab::create_client();
    
    let mut request = match method {
        "GET" => client.get(&url),
        "POST" => client.post(&url),
        "PUT" => client.put(&url),
        "DELETE" => client.delete(&url),
        "PATCH" => client.patch(&url),
        _ => return Err(format!("Unsupported method: {}", method)),
    };

    // Add default headers
    request = request.header("Content-Type", "application/json");
    request = request.header("Accept", "application/json");

    // Add custom headers
    if let Some(headers) = headers {
        for (key, value) in headers {
            request = request.header(&key, value);
        }
    }

    // Add body for POST/PUT/PATCH
    if let Some(body) = body {
        request = request.json(&body);
    }

    // Send request with timeout
    let response: reqwest::Response = tokio::time::timeout(REQUEST_TIMEOUT, request.send())
        .await
        .map_err(|_| "Request timeout".to_string())?
        .map_err(|e| format!("Request failed: {}", e))?;

    let _status = response.status();
    let text: String = response
        .text()
        .await
        .map_err(|e| format!("Failed to read response: {}", e))?;

    // Parse JSON response
    let json_data: Value = serde_json::from_str(&text)
        .unwrap_or_else(|_| Value::String(text.clone()));

    // Check if response has success field (API format)
    if let Some(success) = json_data.get("success") {
        if success.as_bool() == Some(false) {
            let error_msg = json_data
                .get("error")
                .and_then(|e| e.as_str())
                .unwrap_or("API request failed");
            return Err(error_msg.to_string());
        }
    }

    // Return the data field if present, otherwise return the whole response
    if let Some(data) = json_data.get("data") {
        Ok(data.clone())
    } else {
        Ok(json_data)
    }
}

#[tauri::command]
pub async fn theme_store_request(
    endpoint: String,
    method: String,
    headers: Option<HashMap<String, String>>,
    body: Option<Value>,
    base_url: Option<String>,
) -> Result<Value, String> {
    make_request(endpoint, &method, headers, body, base_url).await
}

#[tauri::command]
pub async fn theme_store_list_themes(
    page: Option<u32>,
    limit: Option<u32>,
    category: Option<String>,
    tags: Option<Vec<String>>,
    search: Option<String>,
    sort: Option<String>,
    featured: Option<bool>,
    min_rating: Option<f64>,
    compatible_version: Option<String>,
    base_url: Option<String>,
) -> Result<Value, String> {
    let mut query_parts = Vec::new();
    
    if let Some(p) = page {
        query_parts.push(format!("page={}", p));
    }
    if let Some(l) = limit {
        query_parts.push(format!("limit={}", l));
    }
    if let Some(c) = category {
        query_parts.push(format!("category={}", urlencoding::encode(&c)));
    }
    if let Some(t) = tags {
        query_parts.push(format!("tags={}", urlencoding::encode(&t.join(","))));
    }
    if let Some(s) = search {
        query_parts.push(format!("search={}", urlencoding::encode(&s)));
    }
    if let Some(sort_val) = sort {
        query_parts.push(format!("sort={}", sort_val));
    }
    if let Some(f) = featured {
        query_parts.push(format!("featured={}", f));
    }
    if let Some(mr) = min_rating {
        query_parts.push(format!("min_rating={}", mr));
    }
    if let Some(cv) = compatible_version {
        query_parts.push(format!("compatible_version={}", urlencoding::encode(&cv)));
    }

    let endpoint = if query_parts.is_empty() {
        "".to_string()
    } else {
        format!("?{}", query_parts.join("&"))
    };

    make_request(endpoint, "GET", None, None, base_url).await
}

#[tauri::command]
pub async fn theme_store_get_theme(
    id: String,
    base_url: Option<String>,
) -> Result<Value, String> {
    make_request(format!("/{}", id), "GET", None, None, base_url).await
}

#[tauri::command]
pub async fn theme_store_search_themes(
    query: String,
    filters: Option<Value>,
    base_url: Option<String>,
) -> Result<Value, String> {
    let mut query_parts = vec![format!("q={}", urlencoding::encode(&query))];
    
    if let Some(f) = filters {
        if let Ok(filter_str) = serde_json::to_string(&f) {
            query_parts.push(format!("filters={}", urlencoding::encode(&filter_str)));
        }
    }

    let endpoint = format!("/search?{}", query_parts.join("&"));
    make_request(endpoint, "GET", None, None, base_url).await
}

#[tauri::command]
pub async fn theme_store_get_collections(
    base_url: Option<String>,
) -> Result<Value, String> {
    make_request("/collections".to_string(), "GET", None, None, base_url).await
}

#[tauri::command]
pub async fn theme_store_get_collection(
    id: String,
    base_url: Option<String>,
) -> Result<Value, String> {
    make_request(format!("/collections/{}", id), "GET", None, None, base_url).await
}

#[tauri::command]
pub async fn theme_store_get_spotlight(
    base_url: Option<String>,
) -> Result<Value, String> {
    make_request("/spotlight".to_string(), "GET", None, None, base_url).await
}

#[tauri::command]
pub async fn theme_store_download_theme(
    id: String,
    base_url: Option<String>,
) -> Result<Value, String> {
    make_request(format!("/{}/download", id), "GET", None, None, base_url).await
}

#[tauri::command]
pub async fn theme_store_favorite_theme(
    id: String,
    auth_token: Option<String>,
    base_url: Option<String>,
) -> Result<Value, String> {
    let mut headers = HashMap::new();
    if let Some(token) = auth_token {
        headers.insert("Cookie".to_string(), format!("auth_token={}", token));
    }
    
    make_request(
        format!("/{}/favorite", id),
        "POST",
        Some(headers),
        None,
        base_url,
    )
    .await
}

#[tauri::command]
pub async fn theme_store_unfavorite_theme(
    id: String,
    auth_token: Option<String>,
    base_url: Option<String>,
) -> Result<Value, String> {
    let mut headers = HashMap::new();
    if let Some(token) = auth_token {
        headers.insert("Cookie".to_string(), format!("auth_token={}", token));
    }
    
    make_request(
        format!("/{}/favorite", id),
        "DELETE",
        Some(headers),
        None,
        base_url,
    )
    .await
}

#[tauri::command]
pub async fn theme_store_get_favorites(
    auth_token: Option<String>,
    base_url: Option<String>,
) -> Result<Value, String> {
    let mut headers = HashMap::new();
    if let Some(token) = auth_token {
        headers.insert("Cookie".to_string(), format!("auth_token={}", token));
    }
    
    make_request("/favorites".to_string(), "GET", Some(headers), None, base_url).await
}

#[tauri::command]
pub async fn theme_store_get_user_status(
    id: String,
    auth_token: Option<String>,
    base_url: Option<String>,
) -> Result<Value, String> {
    let mut headers = HashMap::new();
    if let Some(token) = auth_token {
        headers.insert("Cookie".to_string(), format!("auth_token={}", token));
    }
    
    make_request(format!("/{}/user-status", id), "GET", Some(headers), None, base_url).await
}

#[tauri::command]
pub async fn theme_store_rate_theme(
    id: String,
    rating: f64,
    comment: Option<String>,
    auth_token: Option<String>,
    base_url: Option<String>,
) -> Result<Value, String> {
    let mut headers = HashMap::new();
    if let Some(token) = auth_token {
        headers.insert("Cookie".to_string(), format!("auth_token={}", token));
    }
    
    let body = json!({
        "rating": rating,
        "comment": comment
    });
    
    make_request(
        format!("/{}/rating", id),
        "POST",
        Some(headers),
        Some(body),
        base_url,
    )
    .await
}
