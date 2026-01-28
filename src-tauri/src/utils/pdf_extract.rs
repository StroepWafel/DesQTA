use pdf_extract::extract_text;
use regex::Regex;
use crate::netgrab;
use crate::logger;
use std::collections::HashMap;
use std::fs;
use std::io::Write;
use base64::{engine::general_purpose, Engine as _};

const STUDENT_ID: i32 = 69;

/// Extract assessment weighting from PDF
/// Returns the weighting percentage (0-100) or None if not found
pub async fn extract_assessment_weighting(
    assessment_id: i32,
    metaclass_id: i32,
) -> Result<Option<f64>, String> {
    if let Some(logger) = logger::get_logger() {
        let _ = logger.log(
            logger::LogLevel::DEBUG,
            "pdf_extract",
            "extract_assessment_weighting",
            &format!("Extracting weighting for assessment {}", assessment_id),
            serde_json::json!({"assessment_id": assessment_id, "metaclass_id": metaclass_id}),
        );
    }

    // Step 1: Request PDF generation
    let filename = format!("BetterSEQTA-{}", format!("{:015}", rand::random::<u64>()));
    
    let mut headers = HashMap::new();
    headers.insert("Content-Type".to_string(), "application/json; charset=utf-8".to_string());
    
    let print_response = netgrab::fetch_api_data(
        "/seqta/student/print/assessment",
        netgrab::RequestMethod::POST,
        Some(headers),
        Some(serde_json::json!({
            "fileName": filename,
            "id": assessment_id,
            "metaclass": metaclass_id,
            "student": STUDENT_ID,
        })),
        None,
        false,
        false,
        None,
    )
    .await
    .map_err(|e| format!("Failed to request PDF generation: {}", e))?;

    // Step 2: Extract the actual filename from the response
    let actual_filename = if let Ok(response_data) = serde_json::from_str::<serde_json::Value>(&print_response) {
        if let Some(file) = response_data.get("payload").and_then(|p| p.get("file")) {
            file.as_str().unwrap_or(&filename).to_string()
        } else {
            filename
        }
    } else {
        filename
    };

    if let Some(logger) = logger::get_logger() {
        let _ = logger.log(
            logger::LogLevel::DEBUG,
            "pdf_extract",
            "extract_assessment_weighting",
            &format!("PDF filename: {}", actual_filename),
            serde_json::json!({"actual_filename": actual_filename}),
        );
    }

    // Step 3: Small delay to ensure PDF is ready
    tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;

    // Step 4: Fetch the generated PDF as binary (base64 encoded)
    let pdf_path = format!("/seqta/student/report/get?file={}", actual_filename);
    
    let pdf_data_base64 = netgrab::fetch_api_data(
        &pdf_path,
        netgrab::RequestMethod::GET,
        None,
        None,
        None,
        true, // is_image = true to get binary data as base64
        false,
        None,
    )
    .await
    .map_err(|e| format!("Failed to fetch PDF: {}", e))?;
    
    // Decode base64 to get raw PDF bytes
    let pdf_bytes = general_purpose::STANDARD
        .decode(&pdf_data_base64)
        .map_err(|e| format!("Failed to decode base64 PDF data: {}", e))?;

    if let Some(logger) = logger::get_logger() {
        let _ = logger.log(
            logger::LogLevel::DEBUG,
            "pdf_extract",
            "extract_assessment_weighting",
            "PDF data fetched",
            serde_json::json!({"pdf_data_length": pdf_bytes.len(), "assessment_id": assessment_id}),
        );
    }

    // Step 5: Extract text from PDF
    let text = extract_text_from_pdf(&pdf_bytes)?;

    if let Some(logger) = logger::get_logger() {
        let _ = logger.log(
            logger::LogLevel::DEBUG,
            "pdf_extract",
            "extract_assessment_weighting",
            "Text extracted from PDF",
            serde_json::json!({"text_length": text.len(), "text_sample": text.chars().take(500).collect::<String>()}),
        );
    }

    // Step 6: Extract weight from text using regex
    let weight = extract_weight_from_text(&text);

    if let Some(logger) = logger::get_logger() {
        if let Some(w) = weight {
            let _ = logger.log(
                logger::LogLevel::INFO,
                "pdf_extract",
                "extract_assessment_weighting",
                &format!("Found weighting: {}%", w),
                serde_json::json!({"assessment_id": assessment_id, "weighting": w}),
            );
        } else {
            let _ = logger.log(
                logger::LogLevel::WARN,
                "pdf_extract",
                "extract_assessment_weighting",
                "Weight not found in PDF",
                serde_json::json!({"assessment_id": assessment_id, "text_length": text.len(), "text_sample": text.chars().take(1000).collect::<String>()}),
            );
        }
    }

    Ok(weight)
}

/// Extract text content from PDF data using pdf-extract
/// Writes PDF data to a temporary file and extracts text from it
fn extract_text_from_pdf(pdf_bytes: &[u8]) -> Result<String, String> {
    // Create a temporary file path
    let temp_dir = std::env::temp_dir();
    let temp_file = temp_dir.join(format!("assessment_pdf_{}.pdf", uuid::Uuid::new_v4()));
    
    // Write PDF bytes to temporary file
    let mut file = fs::File::create(&temp_file)
        .map_err(|e| format!("Failed to create temp file: {}", e))?;
    
    file.write_all(pdf_bytes)
        .map_err(|e| format!("Failed to write PDF data to temp file: {}", e))?;
    
    // Ensure data is flushed
    file.sync_all()
        .map_err(|e| format!("Failed to sync temp file: {}", e))?;
    
    // Extract text from PDF file
    let text = extract_text(&temp_file)
        .map_err(|e| format!("Failed to extract text from PDF: {}", e))?;
    
    // Clean up temporary file
    let _ = fs::remove_file(&temp_file);
    
    Ok(text)
}

/// Extract assessment weight from PDF text using regex
fn extract_weight_from_text(text: &str) -> Option<f64> {
    // Try multiple patterns to find the weight
    // Pattern 1: "Assessment weight: 35" (case insensitive, flexible spacing)
    let patterns = vec![
        r"(?i)Assessment\s+weight\s*:\s*(\d+\.?\d*)",
        r"(?i)Weight\s*:\s*(\d+\.?\d*)\s*%",
        r"(?i)Assessment\s+weight\s*:\s*(\d+\.?\d*)\s*%",
    ];

    for pattern in patterns {
        if let Ok(re) = Regex::new(pattern) {
            if let Some(captures) = re.captures(text) {
                if let Some(weight_str) = captures.get(1) {
                    if let Ok(weight) = weight_str.as_str().parse::<f64>() {
                        if weight >= 0.0 {
                            return Some(weight);
                        }
                    }
                }
            }
        }
    }

    None
}

#[tauri::command]
pub async fn get_assessment_weighting(
    assessment_id: i32,
    metaclass_id: i32,
) -> Result<Option<f64>, String> {
    extract_assessment_weighting(assessment_id, metaclass_id).await
}
