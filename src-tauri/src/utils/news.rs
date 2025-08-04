use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct Article {
    pub title: Option<String>,
    pub description: Option<String>,
    pub url: Option<String>,
    #[serde(rename = "urlToImage")]
    pub url_to_image: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct NewsApiResponse {
    pub status: Option<String>,
    #[serde(rename = "totalResults")]
    pub total_results: Option<u32>,
    pub articles: Option<Vec<Article>>,
    pub code: Option<String>,
    pub message: Option<String>,
}

#[tauri::command]
pub async fn get_news_australia(from: String, domains: String) -> Result<NewsApiResponse, String> {
    // NOTE: Ideally move the API key to a secure config/env. For now, mirror the current usage.
    let api_key = "17c0da766ba347c89d094449504e3080";
    let mut url = format!(
        "https://newsapi.org/v2/everything?domains={}&from={}&apiKey={}",
        urlencoding::encode(&domains),
        urlencoding::encode(&from),
        api_key
    );

    let client = reqwest::Client::new();

    // First attempt
    let mut resp = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("request error: {}", e))?;

    // Handle rate limiting similar to frontend logic
    if resp.status().as_u16() == 429 {
        url.push_str("%00"); // cache-busting tweak
        resp = client
            .get(&url)
            .send()
            .await
            .map_err(|e| format!("retry request error: {}", e))?;
    }

    let status = resp.status();
    let text = resp.text().await.map_err(|e| format!("read body error: {}", e))?;

    let parsed: Result<NewsApiResponse, _> = serde_json::from_str(&text);

    match parsed {
        Ok(mut data) => {
            // If rate limited per response body, mirror frontend’s empty articles behavior
            if status.as_u16() == 429 || data.code.as_deref() == Some("rateLimited") {
                data.articles = Some(vec![]);
            }
            Ok(data)
        }
        Err(e) => Err(format!("parse error: {} | body: {}", e, text)),
    }
}
