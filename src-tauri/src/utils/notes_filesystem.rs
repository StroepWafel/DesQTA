use base64::{engine::general_purpose, Engine as _};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use tauri::AppHandle;
use uuid::Uuid;
use walkdir::WalkDir;

// Define types directly here (moved from notes.rs)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SeqtaReference {
    #[serde(rename = "type")]
    pub ref_type: String, // 'subject' | 'assessment' | 'teacher' | 'class' | 'assignment' | 'portal'
    pub id: String,
    pub display_name: String,
    #[serde(default)]
    pub cached_data: Option<serde_json::Value>,
    #[serde(default)]
    pub last_synced: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NoteMetadata {
    pub word_count: u32,
    pub character_count: u32,
    pub reading_time: u32, // in minutes
    #[serde(default)]
    pub last_auto_save: Option<String>,
    pub version: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Note {
    pub id: String,
    pub title: String,
    pub content: String, // Raw HTML content with custom tags
    pub folder_path: Vec<String>,
    pub tags: Vec<String>,
    pub seqta_references: Vec<SeqtaReference>,
    pub created_at: String,
    pub updated_at: String,
    pub last_accessed: String,
    pub metadata: NoteMetadata,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileSystemNote {
    pub id: String,
    pub title: String,
    pub content: String,
    pub tags: Vec<String>,
    pub seqta_references: Vec<SeqtaReference>,
    pub created_at: String,
    pub updated_at: String,
    pub last_accessed: String,
    pub metadata: NoteMetadata,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileSystemFolder {
    pub id: String,
    pub name: String,
    pub path: String, // Relative path from notes root
    pub color: Option<String>,
    pub icon: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileTreeItem {
    pub id: String,
    pub name: String,
    pub path: String,
    pub item_type: String, // "file" | "folder"
    pub size: Option<u64>,
    pub modified: String,
    pub children: Option<Vec<FileTreeItem>>,
}

/// Get the notes directory path
fn get_notes_directory(_app: &AppHandle) -> Result<PathBuf, String> {
    #[cfg(target_os = "android")]
    {
        let mut dir = PathBuf::from("/data/data/com.desqta.app/files");
        dir.push("DesQTA");
        dir.push("notes");
        if !dir.exists() {
            fs::create_dir_all(&dir).map_err(|e| format!("Failed to create notes dir: {}", e))?;
        }
        Ok(dir)
    }
    #[cfg(not(target_os = "android"))]
    {
        let mut dir =
            dirs_next::data_dir().ok_or_else(|| "Unable to determine data dir".to_string())?;
        dir.push("DesQTA");
        dir.push("notes");
        if !dir.exists() {
            fs::create_dir_all(&dir).map_err(|e| format!("Failed to create notes dir: {}", e))?;
        }
        Ok(dir)
    }
}

/// Generate a safe filename from a title
fn sanitize_filename(title: &str) -> String {
    let mut filename = title
        .chars()
        .map(|c| match c {
            '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|' => '_',
            c if c.is_control() => '_',
            c => c,
        })
        .collect::<String>();

    // Limit length and ensure it's not empty
    if filename.is_empty() {
        filename = "Untitled".to_string();
    }

    if filename.len() > 100 {
        filename.truncate(100);
    }

    filename
}

/// Convert filesystem note to Note struct for compatibility
fn filesystem_note_to_note(fs_note: FileSystemNote, relative_path: &str) -> Note {
    let folder_path = Path::new(relative_path)
        .parent()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_default();

    let folder_parts: Vec<String> = if folder_path.is_empty() {
        vec!["default".to_string()]
    } else {
        folder_path.split('/').map(|s| s.to_string()).collect()
    };

    Note {
        id: fs_note.id,
        title: fs_note.title,
        content: fs_note.content,
        folder_path: folder_parts,
        tags: fs_note.tags,
        seqta_references: fs_note.seqta_references,
        created_at: fs_note.created_at,
        updated_at: fs_note.updated_at,
        last_accessed: fs_note.last_accessed,
        metadata: fs_note.metadata,
    }
}

/// Convert Note to filesystem note
fn note_to_filesystem_note(note: Note) -> FileSystemNote {
    FileSystemNote {
        id: note.id,
        title: note.title,
        content: note.content,
        tags: note.tags,
        seqta_references: note.seqta_references,
        created_at: note.created_at,
        updated_at: note.updated_at,
        last_accessed: note.last_accessed,
        metadata: note.metadata,
    }
}

// Tauri Commands

#[tauri::command]
pub fn load_notes_filesystem(app: AppHandle) -> Result<Vec<Note>, String> {
    let notes_dir = get_notes_directory(&app)?;
    let mut notes = Vec::new();

    for entry in WalkDir::new(&notes_dir)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| {
            e.file_type().is_file() && e.path().extension().map_or(false, |ext| ext == "json")
        })
    {
        let relative_path = entry
            .path()
            .strip_prefix(&notes_dir)
            .map_err(|e| format!("Failed to get relative path: {}", e))?
            .to_string_lossy()
            .to_string();

        match load_note_file(entry.path()) {
            Ok(fs_note) => {
                notes.push(filesystem_note_to_note(fs_note, &relative_path));
            }
            Err(e) => {
                eprintln!("Failed to load note {}: {}", relative_path, e);
            }
        }
    }

    // Sort by updated_at descending
    notes.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));

    Ok(notes)
}

#[tauri::command]
pub fn save_note_filesystem(app: AppHandle, note: Note) -> Result<(), String> {
    let notes_dir = get_notes_directory(&app)?;
    let fs_note = note_to_filesystem_note(note.clone());

    // Check if a note with this ID already exists but with a different title
    // If so, delete the old file to prevent duplicates
    for entry in WalkDir::new(&notes_dir)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| {
            e.file_type().is_file() && e.path().extension().map_or(false, |ext| ext == "json")
        })
    {
        if let Ok(existing_fs_note) = load_note_file(entry.path()) {
            if existing_fs_note.id == note.id {
                let existing_filename = entry
                    .path()
                    .file_stem()
                    .and_then(|s| s.to_str())
                    .unwrap_or("");
                let new_filename = sanitize_filename(&note.title);

                // If the filename would be different, delete the old file
                if existing_filename != new_filename {
                    if let Err(e) = fs::remove_file(entry.path()) {
                        eprintln!(
                            "Failed to delete old note file {}: {}",
                            entry.path().display(),
                            e
                        );
                    }
                }
                break;
            }
        }
    }

    // Create folder structure if needed
    let folder_path = if note.folder_path.is_empty() || note.folder_path[0] == "default" {
        notes_dir.clone()
    } else {
        let mut path = notes_dir.clone();
        for folder in &note.folder_path {
            if folder != "default" {
                path.push(folder);
            }
        }
        if !path.exists() {
            fs::create_dir_all(&path)
                .map_err(|e| format!("Failed to create folder structure: {}", e))?;
        }
        path
    };

    // Generate filename
    let filename = format!("{}.json", sanitize_filename(&note.title));
    let file_path = folder_path.join(&filename);

    // Save note
    save_note_file(&file_path, &fs_note)?;

    Ok(())
}

#[tauri::command]
pub fn delete_note_filesystem(app: AppHandle, note_id: String) -> Result<(), String> {
    let notes_dir = get_notes_directory(&app)?;

    // Find the note file
    for entry in WalkDir::new(&notes_dir)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| {
            e.file_type().is_file() && e.path().extension().map_or(false, |ext| ext == "json")
        })
    {
        if let Ok(fs_note) = load_note_file(entry.path()) {
            if fs_note.id == note_id {
                fs::remove_file(entry.path())
                    .map_err(|e| format!("Failed to delete note file: {}", e))?;
                return Ok(());
            }
        }
    }

    Err("Note not found".to_string())
}

#[tauri::command]
pub fn create_folder_filesystem(
    app: AppHandle,
    name: String,
    parent_path: Option<String>,
) -> Result<FileSystemFolder, String> {
    let notes_dir = get_notes_directory(&app)?;

    let folder_path = if let Some(parent) = parent_path {
        notes_dir.join(&parent).join(&name)
    } else {
        notes_dir.join(&name)
    };

    if folder_path.exists() {
        return Err("Folder already exists".to_string());
    }

    fs::create_dir_all(&folder_path).map_err(|e| format!("Failed to create folder: {}", e))?;

    let relative_path = folder_path
        .strip_prefix(&notes_dir)
        .map_err(|e| format!("Failed to get relative path: {}", e))?
        .to_string_lossy()
        .to_string();

    let folder = FileSystemFolder {
        id: Uuid::new_v4().to_string(),
        name: name.clone(),
        path: relative_path,
        color: None,
        icon: Some("📁".to_string()),
        created_at: Utc::now().to_rfc3339(),
        updated_at: Utc::now().to_rfc3339(),
    };

    Ok(folder)
}

#[tauri::command]
pub fn delete_folder_filesystem(app: AppHandle, folder_path: String) -> Result<(), String> {
    let notes_dir = get_notes_directory(&app)?;
    let full_path = notes_dir.join(&folder_path);

    if !full_path.exists() {
        return Err("Folder does not exist".to_string());
    }

    // Check if folder is empty
    let is_empty = full_path
        .read_dir()
        .map_err(|e| format!("Failed to read folder: {}", e))?
        .next()
        .is_none();

    if !is_empty {
        return Err("Folder is not empty. Please move or delete all contents first.".to_string());
    }

    fs::remove_dir(&full_path).map_err(|e| format!("Failed to delete folder: {}", e))?;

    Ok(())
}

#[tauri::command]
pub fn rename_folder_filesystem(
    app: AppHandle,
    old_path: String,
    new_name: String,
) -> Result<(), String> {
    let notes_dir = get_notes_directory(&app)?;
    let old_full_path = notes_dir.join(&old_path);

    let new_full_path = old_full_path
        .parent()
        .ok_or("Invalid folder path")?
        .join(&new_name);

    if new_full_path.exists() {
        return Err("A folder with that name already exists".to_string());
    }

    fs::rename(&old_full_path, &new_full_path)
        .map_err(|e| format!("Failed to rename folder: {}", e))?;

    Ok(())
}

#[tauri::command]
pub fn get_file_tree(app: AppHandle) -> Result<Vec<FileTreeItem>, String> {
    let notes_dir = get_notes_directory(&app)?;
    build_file_tree(&notes_dir, &notes_dir)
}

#[tauri::command]
pub fn move_note_filesystem(
    app: AppHandle,
    note_id: String,
    new_folder_path: Vec<String>,
) -> Result<(), String> {
    let notes_dir = get_notes_directory(&app)?;

    // Find the current note file
    for entry in WalkDir::new(&notes_dir)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| {
            e.file_type().is_file() && e.path().extension().map_or(false, |ext| ext == "json")
        })
    {
        if let Ok(mut fs_note) = load_note_file(entry.path()) {
            if fs_note.id == note_id {
                // Delete old file
                fs::remove_file(entry.path())
                    .map_err(|e| format!("Failed to delete old note file: {}", e))?;

                // Create new folder structure
                let new_folder = if new_folder_path.is_empty() || new_folder_path[0] == "default" {
                    notes_dir.clone()
                } else {
                    let mut path = notes_dir.clone();
                    for folder in &new_folder_path {
                        if folder != "default" {
                            path.push(folder);
                        }
                    }
                    if !path.exists() {
                        fs::create_dir_all(&path)
                            .map_err(|e| format!("Failed to create folder structure: {}", e))?;
                    }
                    path
                };

                // Save to new location
                let filename = format!("{}.json", sanitize_filename(&fs_note.title));
                let new_file_path = new_folder.join(&filename);

                fs_note.updated_at = Utc::now().to_rfc3339();
                save_note_file(&new_file_path, &fs_note)?;

                return Ok(());
            }
        }
    }

    Err("Note not found".to_string())
}

// Helper functions

fn load_note_file(path: &Path) -> Result<FileSystemNote, String> {
    let mut file = File::open(path).map_err(|e| format!("Failed to open note file: {}", e))?;
    let mut contents = String::new();
    file.read_to_string(&mut contents)
        .map_err(|e| format!("Failed to read note file: {}", e))?;

    serde_json::from_str(&contents).map_err(|e| format!("Failed to parse note JSON: {}", e))
}

fn save_note_file(path: &Path, note: &FileSystemNote) -> Result<(), String> {
    let json = serde_json::to_string_pretty(note)
        .map_err(|e| format!("Failed to serialize note: {}", e))?;

    let mut file = File::create(path).map_err(|e| format!("Failed to create note file: {}", e))?;
    file.write_all(json.as_bytes())
        .map_err(|e| format!("Failed to write note file: {}", e))?;

    Ok(())
}

fn build_file_tree(dir: &Path, root: &Path) -> Result<Vec<FileTreeItem>, String> {
    let mut items = Vec::new();

    let entries = fs::read_dir(dir).map_err(|e| format!("Failed to read directory: {}", e))?;

    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read directory entry: {}", e))?;
        let path = entry.path();
        let name = path
            .file_name()
            .ok_or("Invalid filename")?
            .to_string_lossy()
            .to_string();

        let relative_path = path
            .strip_prefix(root)
            .map_err(|e| format!("Failed to get relative path: {}", e))?
            .to_string_lossy()
            .to_string();

        let metadata = entry
            .metadata()
            .map_err(|e| format!("Failed to get file metadata: {}", e))?;

        let modified = metadata
            .modified()
            .map_err(|e| format!("Failed to get modified time: {}", e))?;

        let modified_str = DateTime::<Utc>::from(modified).to_rfc3339();

        if path.is_dir() {
            let children = build_file_tree(&path, root)?;
            items.push(FileTreeItem {
                id: Uuid::new_v4().to_string(),
                name,
                path: relative_path,
                item_type: "folder".to_string(),
                size: None,
                modified: modified_str,
                children: Some(children),
            });
        } else if path.extension().map_or(false, |ext| ext == "json") {
            items.push(FileTreeItem {
                id: Uuid::new_v4().to_string(),
                name: name.trim_end_matches(".json").to_string(),
                path: relative_path,
                item_type: "file".to_string(),
                size: Some(metadata.len()),
                modified: modified_str,
                children: None,
            });
        }
    }

    // Sort: folders first, then files, both alphabetically
    items.sort_by(|a, b| match (a.item_type.as_str(), b.item_type.as_str()) {
        ("folder", "file") => std::cmp::Ordering::Less,
        ("file", "folder") => std::cmp::Ordering::Greater,
        _ => a.name.cmp(&b.name),
    });

    Ok(items)
}

// Search functionality

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResult {
    pub note: Note,
    pub score: f32,
    pub matches: Vec<SearchMatch>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchMatch {
    pub field: String, // "title", "content", "tags", "seqta_references"
    pub snippet: String,
    pub position: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchFilters {
    pub folder_ids: Option<Vec<String>>,
    pub tags: Option<Vec<String>>,
    pub date_from: Option<String>,
    pub date_to: Option<String>,
    pub word_count_min: Option<u32>,
    pub word_count_max: Option<u32>,
    pub has_seqta_references: Option<bool>,
}

#[tauri::command]
pub fn search_notes_filesystem(app: AppHandle, query: String) -> Result<Vec<Note>, String> {
    let notes = load_notes_filesystem(app)?;
    let query_lower = query.to_lowercase();

    let matching_notes: Vec<Note> = notes
        .into_iter()
        .filter(|note| {
            note.title.to_lowercase().contains(&query_lower) ||
            note.tags.iter().any(|tag| tag.to_lowercase().contains(&query_lower)) ||
            // Search in content text (HTML content)
            note.content.to_lowercase().contains(&query_lower)
        })
        .collect();

    Ok(matching_notes)
}

#[tauri::command]
pub fn search_notes_advanced_filesystem(
    app: AppHandle,
    query: String,
    filters: Option<SearchFilters>,
) -> Result<Vec<SearchResult>, String> {
    let notes = load_notes_filesystem(app)?;
    let query_lower = query.trim().to_lowercase();

    if query_lower.is_empty() {
        return Ok(vec![]);
    }

    let search_terms: Vec<&str> = query_lower.split_whitespace().collect();
    let mut results: Vec<SearchResult> = Vec::new();

    for note in notes {
        // Apply folder filter
        if let Some(ref f) = filters {
            if let Some(ref folder_ids) = f.folder_ids {
                if !folder_ids.iter().any(|fid| note.folder_path.contains(fid)) {
                    continue;
                }
            }

            // Apply tag filter
            if let Some(ref filter_tags) = f.tags {
                if !filter_tags.iter().any(|tag| note.tags.contains(tag)) {
                    continue;
                }
            }

            // Apply date filters
            if let Some(ref date_from) = f.date_from {
                if note.created_at < *date_from {
                    continue;
                }
            }

            if let Some(ref date_to) = f.date_to {
                if note.created_at > *date_to {
                    continue;
                }
            }

            // Apply word count filters
            if let Some(min_words) = f.word_count_min {
                if note.metadata.word_count < min_words {
                    continue;
                }
            }

            if let Some(max_words) = f.word_count_max {
                if note.metadata.word_count > max_words {
                    continue;
                }
            }

            // Apply SEQTA references filter
            if let Some(has_seqta) = f.has_seqta_references {
                let note_has_seqta = !note.seqta_references.is_empty();
                if has_seqta != note_has_seqta {
                    continue;
                }
            }
        }

        let mut score = 0.0f32;
        let mut matches = Vec::new();

        // Search in title (highest weight)
        let title_lower = note.title.to_lowercase();
        for term in &search_terms {
            if title_lower.contains(term) {
                score += 10.0;
                if let Some(pos) = title_lower.find(term) {
                    matches.push(SearchMatch {
                        field: "title".to_string(),
                        snippet: highlight_match(&note.title, term, pos),
                        position: pos,
                    });
                }
            }
        }

        // Search in tags (high weight)
        for tag in &note.tags {
            let tag_lower = tag.to_lowercase();
            for term in &search_terms {
                if tag_lower.contains(term) {
                    score += 5.0;
                    matches.push(SearchMatch {
                        field: "tags".to_string(),
                        snippet: tag.clone(),
                        position: 0,
                    });
                }
            }
        }

        // Search in content (medium weight)
        let content_text = strip_html_tags(&note.content);
        let content_lower = content_text.to_lowercase();
        for term in &search_terms {
            if content_lower.contains(term) {
                score += 2.0;
                if let Some(pos) = content_lower.find(term) {
                    matches.push(SearchMatch {
                        field: "content".to_string(),
                        snippet: create_snippet(&content_text, term, pos),
                        position: pos,
                    });
                }
            }
        }

        // Search in SEQTA references (low weight)
        for seqta_ref in &note.seqta_references {
            let display_name_lower = seqta_ref.display_name.to_lowercase();
            for term in &search_terms {
                if display_name_lower.contains(term) {
                    score += 1.0;
                    matches.push(SearchMatch {
                        field: "seqta_references".to_string(),
                        snippet: seqta_ref.display_name.clone(),
                        position: 0,
                    });
                }
            }
        }

        // Boost score for exact matches
        if title_lower == query_lower {
            score += 20.0;
        }

        // Boost score for matches at the beginning
        if title_lower.starts_with(&query_lower) {
            score += 5.0;
        }

        // Only include notes with matches
        if score > 0.0 {
            results.push(SearchResult {
                note,
                score,
                matches,
            });
        }
    }

    // Sort by score (descending) and then by update date (descending)
    results.sort_by(|a, b| {
        b.score
            .partial_cmp(&a.score)
            .unwrap_or(std::cmp::Ordering::Equal)
            .then_with(|| b.note.updated_at.cmp(&a.note.updated_at))
    });

    Ok(results)
}

fn highlight_match(text: &str, term: &str, position: usize) -> String {
    let start = position.saturating_sub(20);
    let end = (position + term.len() + 20).min(text.len());
    let snippet = &text[start..end];

    if start > 0 {
        format!("...{}", snippet)
    } else if end < text.len() {
        format!("{}...", snippet)
    } else {
        snippet.to_string()
    }
}

fn create_snippet(text: &str, term: &str, position: usize) -> String {
    let start = position.saturating_sub(50);
    let end = (position + term.len() + 50).min(text.len());
    let snippet = &text[start..end];

    let prefix = if start > 0 { "..." } else { "" };
    let suffix = if end < text.len() { "..." } else { "" };

    format!("{}{}{}", prefix, snippet, suffix)
}

fn strip_html_tags(html: &str) -> String {
    // Simple HTML tag removal
    let mut result = String::new();
    let mut in_tag = false;

    for ch in html.chars() {
        match ch {
            '<' => in_tag = true,
            '>' => in_tag = false,
            _ if !in_tag => result.push(ch),
            _ => {} // Skip characters inside tags
        }
    }

    result
}

// Image handling functions

fn get_notes_images_dir(_app: &AppHandle) -> Result<PathBuf, String> {
    #[cfg(target_os = "android")]
    {
        let mut dir = PathBuf::from("/data/data/com.desqta.app/files");
        dir.push("note_contents");
        if !dir.exists() {
            fs::create_dir_all(&dir)
                .map_err(|e| format!("Failed to create note_contents directory: {}", e))?;
        }
        Ok(dir)
    }
    #[cfg(not(target_os = "android"))]
    {
        let mut dir =
            dirs_next::data_dir().ok_or_else(|| "Unable to determine data dir".to_string())?;
        dir.push("DesQTA");
        if !dir.exists() {
            fs::create_dir_all(&dir).map_err(|e| format!("Failed to create data dir: {}", e))?;
        }
        dir.push("note_contents");
        if !dir.exists() {
            fs::create_dir_all(&dir)
                .map_err(|e| format!("Failed to create note_contents directory: {}", e))?;
        }
        Ok(dir)
    }
}

#[tauri::command]
pub fn save_image_from_base64_filesystem(
    app: AppHandle,
    note_id: String,
    image_data: String,
    filename: String,
) -> Result<String, String> {
    // Remove data URL prefix if present
    let base64_data = if image_data.starts_with("data:") {
        image_data.split(',').nth(1).unwrap_or(&image_data)
    } else {
        &image_data
    };

    // Decode base64
    let image_bytes = general_purpose::STANDARD
        .decode(base64_data)
        .map_err(|e| format!("Failed to decode base64 image: {}", e))?;

    // Get images directory
    let images_dir = get_notes_images_dir(&app)?;

    // Create note-specific directory
    let note_images_dir = images_dir.join(&note_id);
    if !note_images_dir.exists() {
        fs::create_dir_all(&note_images_dir)
            .map_err(|e| format!("Failed to create note images directory: {}", e))?;
    }

    // Generate unique filename
    let timestamp = chrono::Utc::now().timestamp_millis();
    let file_extension = filename.split('.').last().unwrap_or("png");
    let unique_filename = format!(
        "{}_{}.{}",
        timestamp,
        filename.replace(".", "_"),
        file_extension
    );

    let image_path = note_images_dir.join(&unique_filename);

    // Write image to file
    let mut file =
        File::create(&image_path).map_err(|e| format!("Failed to create image file: {}", e))?;
    file.write_all(&image_bytes)
        .map_err(|e| format!("Failed to write image data: {}", e))?;

    // Return relative path for storage in note content
    let relative_path = format!("note_contents/{}/{}", note_id, unique_filename);
    Ok(relative_path)
}

#[tauri::command]
pub fn get_image_path_filesystem(_app: AppHandle, relative_path: String) -> Result<String, String> {
    // Get the base notes directory (same as notes.json location but without the filename)
    #[cfg(target_os = "android")]
    let base_dir = PathBuf::from("/data/data/com.desqta.app/files");

    #[cfg(not(target_os = "android"))]
    let base_dir = {
        let mut dir =
            dirs_next::data_dir().ok_or_else(|| "Unable to determine data dir".to_string())?;
        dir.push("DesQTA");
        dir
    };

    let full_path = base_dir.join(&relative_path);

    if !full_path.exists() {
        return Err(format!("Image file does not exist: {}", relative_path));
    }

    full_path
        .to_str()
        .ok_or("Failed to convert path to string".to_string())
        .map(|s| s.to_string())
}

#[tauri::command]
pub fn get_image_as_base64_filesystem(
    _app: AppHandle,
    relative_path: String,
) -> Result<String, String> {
    // Get the base notes directory
    #[cfg(target_os = "android")]
    let base_dir = PathBuf::from("/data/data/com.desqta.app/files");

    #[cfg(not(target_os = "android"))]
    let base_dir = {
        let mut dir =
            dirs_next::data_dir().ok_or_else(|| "Unable to determine data dir".to_string())?;
        dir.push("DesQTA");
        dir
    };

    let full_path = base_dir.join(&relative_path);

    if !full_path.exists() {
        return Err(format!("Image file does not exist: {}", relative_path));
    }

    // Read the file
    let image_bytes =
        fs::read(&full_path).map_err(|e| format!("Failed to read image file: {}", e))?;

    // Encode as base64
    let base64_data = general_purpose::STANDARD.encode(&image_bytes);

    // Determine MIME type from extension
    let extension = full_path
        .extension()
        .and_then(|ext| ext.to_str())
        .unwrap_or("png")
        .to_lowercase();

    let mime_type = match extension.as_str() {
        "jpg" | "jpeg" => "image/jpeg",
        "png" => "image/png",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "svg" => "image/svg+xml",
        _ => "image/png",
    };

    // Return as data URL
    Ok(format!("data:{};base64,{}", mime_type, base64_data))
}

#[tauri::command]
pub fn delete_note_images_filesystem(app: AppHandle, note_id: String) -> Result<(), String> {
    let images_dir = get_notes_images_dir(&app)?;
    let note_images_dir = images_dir.join(&note_id);

    if note_images_dir.exists() {
        fs::remove_dir_all(&note_images_dir)
            .map_err(|e| format!("Failed to delete note images: {}", e))?;
    }

    Ok(())
}

#[tauri::command]
pub fn cleanup_unused_images_filesystem(app: AppHandle) -> Result<u32, String> {
    let notes = load_notes_filesystem(app.clone())?;
    let images_dir = get_notes_images_dir(&app)?;

    if !images_dir.exists() {
        return Ok(0);
    }

    let mut deleted_count = 0;

    // Get all note IDs that still exist
    let existing_note_ids: std::collections::HashSet<String> =
        notes.iter().map(|n| n.id.clone()).collect();

    // Iterate through image directories
    if let Ok(entries) = fs::read_dir(&images_dir) {
        for entry in entries.flatten() {
            if let Some(dir_name) = entry.file_name().to_str() {
                // If this directory doesn't correspond to an existing note, delete it
                if !existing_note_ids.contains(dir_name) {
                    if let Err(e) = fs::remove_dir_all(entry.path()) {
                        eprintln!(
                            "Failed to delete unused image directory {}: {}",
                            dir_name, e
                        );
                    } else {
                        deleted_count += 1;
                    }
                }
            }
        }
    }

    Ok(deleted_count)
}

// Backup and utility functions

#[tauri::command]
pub fn get_notes_stats_filesystem(app: AppHandle) -> Result<serde_json::Value, String> {
    let notes = load_notes_filesystem(app.clone())?;

    let total_notes = notes.len();
    let total_words: u32 = notes.iter().map(|n| n.metadata.word_count).sum();

    // Count folders by scanning the file tree
    let file_tree = get_file_tree(app)?;
    let total_folders = count_folders(&file_tree);

    let stats = serde_json::json!({
        "total_notes": total_notes,
        "total_words": total_words,
        "total_folders": total_folders,
        "database_version": "filesystem_1.0"
    });

    Ok(stats)
}

fn count_folders(items: &[FileTreeItem]) -> usize {
    let mut count = 0;
    for item in items {
        if item.item_type == "folder" {
            count += 1;
            if let Some(children) = &item.children {
                count += count_folders(children);
            }
        }
    }
    count
}

#[tauri::command]
pub fn backup_notes_filesystem(app: AppHandle) -> Result<String, String> {
    let notes = load_notes_filesystem(app.clone())?;
    let file_tree = get_file_tree(app)?;
    let timestamp = chrono::Utc::now().format("%Y%m%d_%H%M%S");

    #[cfg(target_os = "android")]
    let backup_dir = PathBuf::from("/data/data/com.desqta.app/files/DesQTA/backups");
    #[cfg(not(target_os = "android"))]
    let backup_dir = dirs_next::data_dir()
        .ok_or_else(|| "Unable to determine data dir".to_string())?
        .join("DesQTA")
        .join("backups");

    if !backup_dir.exists() {
        fs::create_dir_all(&backup_dir)
            .map_err(|e| format!("Failed to create backup dir: {}", e))?;
    }

    let backup_file = backup_dir.join(format!("notes_filesystem_backup_{}.json", timestamp));

    // Create backup structure
    let backup_data = serde_json::json!({
        "version": "filesystem_1.0",
        "timestamp": timestamp.to_string(),
        "notes": notes,
        "file_tree": file_tree,
        "backup_type": "filesystem"
    });

    let json = serde_json::to_string_pretty(&backup_data)
        .map_err(|e| format!("Failed to serialize backup: {}", e))?;

    let mut file =
        File::create(&backup_file).map_err(|e| format!("Failed to create backup file: {}", e))?;
    file.write_all(json.as_bytes())
        .map_err(|e| format!("Failed to write backup file: {}", e))?;

    Ok(backup_file.to_string_lossy().to_string())
}

#[tauri::command]
pub fn restore_notes_from_backup_filesystem(
    app: AppHandle,
    backup_path: String,
) -> Result<(), String> {
    let backup_file = PathBuf::from(backup_path);
    if !backup_file.exists() {
        return Err("Backup file does not exist".to_string());
    }

    let mut file =
        File::open(&backup_file).map_err(|e| format!("Failed to open backup file: {}", e))?;
    let mut contents = String::new();
    file.read_to_string(&mut contents)
        .map_err(|e| format!("Failed to read backup file: {}", e))?;

    let backup_data: serde_json::Value = serde_json::from_str(&contents)
        .map_err(|e| format!("Failed to parse backup JSON: {}", e))?;

    // Check if this is a filesystem backup
    if backup_data.get("backup_type").and_then(|v| v.as_str()) == Some("filesystem") {
        // Extract notes from filesystem backup
        let notes: Vec<Note> = serde_json::from_value(
            backup_data
                .get("notes")
                .unwrap_or(&serde_json::json!([]))
                .clone(),
        )
        .map_err(|e| format!("Failed to parse notes from backup: {}", e))?;

        // Get notes directory and clear it
        let notes_dir = get_notes_directory(&app)?;
        if notes_dir.exists() {
            fs::remove_dir_all(&notes_dir)
                .map_err(|e| format!("Failed to clear notes directory: {}", e))?;
        }

        // Recreate notes directory
        fs::create_dir_all(&notes_dir)
            .map_err(|e| format!("Failed to recreate notes directory: {}", e))?;

        // Save each note
        for note in notes {
            save_note_filesystem(app.clone(), note)?;
        }
    } else {
        return Err(
            "This backup file is not compatible with the filesystem storage system".to_string(),
        );
    }

    Ok(())
}

// Get a specific note by ID
#[tauri::command]
pub fn get_note_filesystem(app: AppHandle, note_id: String) -> Result<Option<Note>, String> {
    let notes = load_notes_filesystem(app)?;
    Ok(notes.into_iter().find(|note| note.id == note_id))
}

// Load folders for compatibility (returns folder structure from file tree)
#[tauri::command]
pub fn load_folders_filesystem(app: AppHandle) -> Result<Vec<FileSystemFolder>, String> {
    let file_tree = get_file_tree(app)?;
    let mut folders = Vec::new();

    fn extract_folders(items: &[FileTreeItem], folders: &mut Vec<FileSystemFolder>) {
        for item in items {
            if item.item_type == "folder" {
                // Use the folder name as ID for consistency (since filesystem folders don't have persistent IDs)
                folders.push(FileSystemFolder {
                    id: item.name.clone(), // Use folder name as ID
                    name: item.name.clone(),
                    path: item.path.clone(),
                    color: None,
                    icon: Some("📁".to_string()),
                    created_at: item.modified.clone(),
                    updated_at: item.modified.clone(),
                });

                if let Some(children) = &item.children {
                    extract_folders(children, folders);
                }
            }
        }
    }

    extract_folders(&file_tree, &mut folders);
    Ok(folders)
}
