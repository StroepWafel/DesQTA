/// Input sanitization utilities for the Rust backend
use regex::Regex;
use once_cell::sync::Lazy;

/// Maximum allowed length for search queries
const MAX_SEARCH_QUERY_LENGTH: usize = 500;

/// Maximum allowed length for filenames
const MAX_FILENAME_LENGTH: usize = 255;

/// Regex patterns for sanitization
static HTML_TAG_PATTERN: Lazy<Regex> = Lazy::new(|| Regex::new(r"<[^>]*>").unwrap());
static JAVASCRIPT_PROTOCOL: Lazy<Regex> = Lazy::new(|| Regex::new(r"(?i)javascript:").unwrap());
static EVENT_HANDLER: Lazy<Regex> = Lazy::new(|| Regex::new(r"(?i)on\w+\s*=").unwrap());
static PATH_TRAVERSAL: Lazy<Regex> = Lazy::new(|| Regex::new(r"\.\./|\.\.\").unwrap());

/// Sanitize search query input
pub fn sanitize_search_query(query: &str) -> String {
    if query.is_empty() {
        return String::new();
    }

    let mut sanitized = query.trim().to_string();

    // Remove HTML tags
    sanitized = HTML_TAG_PATTERN.replace_all(&sanitized, "").to_string();

    // Remove javascript: protocol
    sanitized = JAVASCRIPT_PROTOCOL.replace_all(&sanitized, "").to_string();

    // Remove event handlers
    sanitized = EVENT_HANDLER.replace_all(&sanitized, "").to_string();

    // Remove dangerous characters
    sanitized = sanitized
        .replace('<', "")
        .replace('>', "")
        .replace('"', "")
        .replace('\'', "")
        .replace('\\', "");

    // Limit length
    if sanitized.len() > MAX_SEARCH_QUERY_LENGTH {
        sanitized.truncate(MAX_SEARCH_QUERY_LENGTH);
    }

    sanitized
}

/// Sanitize general text input
pub fn sanitize_text(text: &str) -> String {
    if text.is_empty() {
        return String::new();
    }

    let mut sanitized = text.trim().to_string();

    // Remove HTML tags
    sanitized = HTML_TAG_PATTERN.replace_all(&sanitized, "").to_string();

    // Remove javascript: protocol
    sanitized = JAVASCRIPT_PROTOCOL.replace_all(&sanitized, "").to_string();

    // Remove event handlers
    sanitized = EVENT_HANDLER.replace_all(&sanitized, "").to_string();

    // Remove dangerous characters
    sanitized = sanitized
        .replace('<', "")
        .replace('>', "");

    sanitized
}

/// Sanitize filename
pub fn sanitize_filename(filename: &str) -> String {
    if filename.is_empty() {
        return "unnamed".to_string();
    }

    let mut sanitized = filename.to_string();

    // Remove path traversal attempts
    sanitized = PATH_TRAVERSAL.replace_all(&sanitized, "").to_string();

    // Remove dangerous characters (Windows forbidden chars + common dangerous ones)
    let forbidden_chars = ['<', '>', ':', '"', '|', '?', '*', '\0'];
    for ch in forbidden_chars {
        sanitized = sanitized.replace(ch, "");
    }

    // Remove control characters (ASCII 0-31)
    sanitized = sanitized
        .chars()
        .filter(|&c| c as u32 >= 32)
        .collect();

    // Remove leading dots
    sanitized = sanitized.trim_start_matches('.').to_string();

    // Limit length
    if sanitized.len() > MAX_FILENAME_LENGTH {
        // Try to preserve file extension
        if let Some(pos) = sanitized.rfind('.') {
            let ext = &sanitized[pos..];
            if ext.len() < 10 {
                let name_max_len = MAX_FILENAME_LENGTH - ext.len();
                sanitized = format!("{}{}", &sanitized[..name_max_len], ext);
            } else {
                sanitized.truncate(MAX_FILENAME_LENGTH);
            }
        } else {
            sanitized.truncate(MAX_FILENAME_LENGTH);
        }
    }

    if sanitized.is_empty() {
        return "unnamed".to_string();
    }

    sanitized
}

/// Validate URL
pub fn validate_url(url: &str) -> Result<String, String> {
    if url.is_empty() {
        return Err("Empty URL".to_string());
    }

    // Parse URL
    match url::Url::parse(url) {
        Ok(parsed_url) => {
            // Only allow http, https, and mailto protocols
            let allowed_protocols = ["http", "https", "mailto"];
            if !allowed_protocols.contains(&parsed_url.scheme()) {
                return Err(format!("Blocked dangerous URL protocol: {}", parsed_url.scheme()));
            }

            Ok(parsed_url.to_string())
        }
        Err(e) => Err(format!("Invalid URL: {}", e)),
    }
}

/// Validate file extension
pub fn validate_file_extension(filename: &str, allowed_extensions: &[&str]) -> Result<(), String> {
    if filename.is_empty() {
        return Err("Empty filename".to_string());
    }

    let extension = filename
        .split('.')
        .last()
        .unwrap_or("")
        .to_lowercase();

    if !allowed_extensions.iter().any(|&ext| ext == extension) {
        return Err(format!("File extension '{}' not allowed", extension));
    }

    Ok(())
}

/// Validate file size
pub fn validate_file_size(size_bytes: usize, max_size_mb: usize) -> Result<(), String> {
    let max_bytes = max_size_mb * 1024 * 1024;
    
    if size_bytes > max_bytes {
        return Err(format!(
            "File size ({} bytes) exceeds maximum allowed size ({} MB)",
            size_bytes, max_size_mb
        ));
    }

    Ok(())
}

/// Escape HTML entities
pub fn escape_html(text: &str) -> String {
    text.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&#039;")
}

/// Sanitize JSON key names (prevent prototype pollution)
pub fn sanitize_json_key(key: &str) -> Result<String, String> {
    let dangerous_keys = ["__proto__", "constructor", "prototype"];
    
    if dangerous_keys.contains(&key.to_lowercase().as_str()) {
        return Err(format!("Dangerous JSON key blocked: {}", key));
    }

    Ok(key.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sanitize_search_query() {
        assert_eq!(sanitize_search_query("<script>alert('xss')</script>"), "alert('xss')");
        assert_eq!(sanitize_search_query("javascript:alert(1)"), "alert(1)");
        assert_eq!(sanitize_search_query("onclick=\"alert(1)\""), "");
        assert_eq!(sanitize_search_query("  test query  "), "test query");
    }

    #[test]
    fn test_sanitize_filename() {
        assert_eq!(sanitize_filename("../../etc/passwd"), "etcpasswd");
        assert_eq!(sanitize_filename("test<>file.txt"), "testfile.txt");
        assert_eq!(sanitize_filename(".hidden"), "hidden");
        assert_eq!(sanitize_filename(""), "unnamed");
    }

    #[test]
    fn test_validate_url() {
        assert!(validate_url("https://example.com").is_ok());
        assert!(validate_url("http://example.com").is_ok());
        assert!(validate_url("mailto:test@example.com").is_ok());
        assert!(validate_url("javascript:alert(1)").is_err());
        assert!(validate_url("file:///etc/passwd").is_err());
    }

    #[test]
    fn test_validate_file_extension() {
        let allowed = vec!["txt", "pdf", "png"];
        assert!(validate_file_extension("test.txt", &allowed).is_ok());
        assert!(validate_file_extension("test.exe", &allowed).is_err());
    }

    #[test]
    fn test_validate_file_size() {
        assert!(validate_file_size(1024 * 1024, 5).is_ok()); // 1MB file, 5MB limit
        assert!(validate_file_size(10 * 1024 * 1024, 5).is_err()); // 10MB file, 5MB limit
    }

    #[test]
    fn test_escape_html() {
        assert_eq!(escape_html("<div>test</div>"), "&lt;div&gt;test&lt;/div&gt;");
        assert_eq!(escape_html("\"quoted\""), "&quot;quoted&quot;");
    }
}

