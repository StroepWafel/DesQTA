use ammonia::Builder;
use scraper::{Html, Selector};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};

/// Configuration for HTML sanitization
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SanitizeConfig {
    /// Allowed HTML tags
    pub allowed_tags: Vec<String>,
    /// Allowed attributes
    pub allowed_attrs: Vec<String>,
    /// Whether to strip all HTML tags (text only)
    pub text_only: bool,
}

impl Default for SanitizeConfig {
    fn default() -> Self {
        Self {
            allowed_tags: vec![
                "p".to_string(),
                "br".to_string(),
                "strong".to_string(),
                "em".to_string(),
                "u".to_string(),
                "h1".to_string(),
                "h2".to_string(),
                "h3".to_string(),
                "h4".to_string(),
                "h5".to_string(),
                "h6".to_string(),
                "ul".to_string(),
                "ol".to_string(),
                "li".to_string(),
                "a".to_string(),
                "img".to_string(),
                "blockquote".to_string(),
                "code".to_string(),
                "pre".to_string(),
                "span".to_string(),
                "div".to_string(),
                "table".to_string(),
                "thead".to_string(),
                "tbody".to_string(),
                "tr".to_string(),
                "th".to_string(),
                "td".to_string(),
            ],
            allowed_attrs: vec![
                "href".to_string(),
                "src".to_string(),
                "alt".to_string(),
                "title".to_string(),
                "class".to_string(),
                "target".to_string(),
                "rel".to_string(),
            ],
            text_only: false,
        }
    }
}

/// Result of HTML parsing operations
#[derive(Debug, Serialize, Deserialize)]
pub struct ParsedHtml {
    /// Sanitized HTML string
    pub sanitized_html: String,
    /// Plain text extracted from HTML
    pub text_content: String,
    /// Extracted links
    pub links: Vec<ExtractedLink>,
    /// Extracted images
    pub images: Vec<ExtractedImage>,
    /// Extracted iframe sources
    pub iframes: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ExtractedLink {
    pub href: String,
    pub text: String,
    pub target: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ExtractedImage {
    pub src: String,
    pub alt: Option<String>,
    pub title: Option<String>,
}

/// Sanitize HTML content using Rust-side parsing with ammonia
pub fn sanitize_html(html: &str, config: Option<SanitizeConfig>) -> Result<String, String> {
    if html.is_empty() {
        return Ok(String::new());
    }

    let config = config.unwrap_or_default();

    if config.text_only {
        // Extract plain text only
        return Ok(extract_text_content(html)?);
    }

    // Configure ammonia sanitizer
    let mut cleaner = Builder::default();
    
    // Set allowed tags
    let mut tags: HashSet<&str> = HashSet::new();
    for tag in &config.allowed_tags {
        tags.insert(tag.as_str());
    }
    cleaner.tags(tags);

    // Set allowed attributes per tag
    let mut tag_attributes: HashMap<&str, HashSet<&str>> = HashMap::new();
    for attr in &config.allowed_attrs {
        // Add attribute to all allowed tags
        for tag in &config.allowed_tags {
            tag_attributes
                .entry(tag.as_str())
                .or_insert_with(HashSet::new)
                .insert(attr.as_str());
        }
    }
    cleaner.tag_attributes(tag_attributes);

    // Clean the HTML
    let cleaned = cleaner.clean(html).to_string();

    // Post-process to add target="_blank" and rel="noopener noreferrer" to links
    let document = Html::parse_document(&cleaned);
    let link_selector = Selector::parse("a").map_err(|e| format!("Failed to parse link selector: {}", e))?;
    
    let mut result = cleaned.clone();
    for element in document.select(&link_selector) {
        let html_str = element.html();
        if !html_str.contains("target=") {
            // Replace link without target attribute
            let new_link = html_str.replace("<a ", "<a target=\"_blank\" rel=\"noopener noreferrer\" ");
            result = result.replace(&html_str, &new_link);
        } else if !html_str.contains("rel=") {
            // Add rel if target exists but rel doesn't
            let new_link = html_str.replace("target=", "target=\"_blank\" rel=\"noopener noreferrer\" ");
            result = result.replace(&html_str, &new_link);
        }
    }

    Ok(result)
}

/// Parse HTML and extract structured data
pub fn parse_html(html: &str) -> Result<ParsedHtml, String> {
    if html.is_empty() {
        return Ok(ParsedHtml {
            sanitized_html: String::new(),
            text_content: String::new(),
            links: Vec::new(),
            images: Vec::new(),
            iframes: Vec::new(),
        });
    }

    let document = Html::parse_document(html);

    // Extract plain text
    let text_content = extract_text_content(html)?;

    // Sanitize HTML
    let sanitized_html = sanitize_html(html, None)?;

    // Extract links
    let link_selector = Selector::parse("a").map_err(|e| format!("Failed to parse link selector: {}", e))?;
    let mut links = Vec::new();
    for element in document.select(&link_selector) {
        let href = element.value().attr("href").unwrap_or("").to_string();
        let text = element.text().collect::<Vec<_>>().join(" ").trim().to_string();
        let target = element.value().attr("target").map(|s| s.to_string());
        links.push(ExtractedLink { href, text, target });
    }

    // Extract images
    let img_selector = Selector::parse("img").map_err(|e| format!("Failed to parse img selector: {}", e))?;
    let mut images = Vec::new();
    for element in document.select(&img_selector) {
        let src = element.value().attr("src").unwrap_or("").to_string();
        let alt = element.value().attr("alt").map(|s| s.to_string());
        let title = element.value().attr("title").map(|s| s.to_string());
        images.push(ExtractedImage { src, alt, title });
    }

    // Extract iframe sources
    let iframe_selector = Selector::parse("iframe").map_err(|e| format!("Failed to parse iframe selector: {}", e))?;
    let mut iframes = Vec::new();
    for element in document.select(&iframe_selector) {
        if let Some(src) = element.value().attr("src") {
            iframes.push(src.to_string());
        }
    }

    Ok(ParsedHtml {
        sanitized_html,
        text_content,
        links,
        images,
        iframes,
    })
}

/// Extract iframe src from HTML (used by WelcomePortal)
pub fn extract_iframe_src(html: &str) -> Result<Option<String>, String> {
    if html.is_empty() {
        return Ok(None);
    }

    let document = Html::parse_document(html);
    let iframe_selector = Selector::parse("iframe").map_err(|e| format!("Failed to parse iframe selector: {}", e))?;

    for element in document.select(&iframe_selector) {
        if let Some(src) = element.value().attr("src") {
            return Ok(Some(src.to_string()));
        }
    }

    Ok(None)
}

/// Extract text content from HTML (for search/preview purposes)
pub fn extract_text_content(html: &str) -> Result<String, String> {
    if html.is_empty() {
        return Ok(String::new());
    }

    let document = Html::parse_document(html);
    let text = document
        .root_element()
        .text()
        .collect::<Vec<_>>()
        .join(" ")
        .trim()
        .to_string();

    Ok(text)
}

/// Tauri command: Sanitize HTML content
#[tauri::command]
pub fn sanitize_html_command(html: String, config: Option<SanitizeConfig>) -> Result<String, String> {
    sanitize_html(&html, config)
}

/// Tauri command: Parse HTML and extract structured data
#[tauri::command]
pub fn parse_html_command(html: String) -> Result<ParsedHtml, String> {
    parse_html(&html)
}

/// Tauri command: Extract iframe src from HTML
#[tauri::command]
pub fn extract_iframe_src_command(html: String) -> Result<Option<String>, String> {
    extract_iframe_src(&html)
}

/// Tauri command: Extract text content from HTML
#[tauri::command]
pub fn extract_text_content_command(html: String) -> Result<String, String> {
    extract_text_content(&html)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sanitize_html() {
        let html = r#"<div><p>Hello <strong>world</strong></p><script>alert('xss')</script></div>"#;
        let sanitized = sanitize_html(html, None).unwrap();
        assert!(sanitized.contains("Hello"));
        assert!(sanitized.contains("world"));
        assert!(!sanitized.contains("script"));
    }

    #[test]
    fn test_extract_iframe_src() {
        let html = r#"<div><iframe src="https://example.com"></iframe></div>"#;
        let src = extract_iframe_src(html).unwrap();
        assert_eq!(src, Some("https://example.com".to_string()));
    }

    #[test]
    fn test_extract_text_content() {
        let html = r#"<div><p>Hello <strong>world</strong></p></div>"#;
        let text = extract_text_content(html).unwrap();
        assert!(text.contains("Hello world"));
    }
}
