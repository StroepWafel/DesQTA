use serde::{Deserialize, Serialize};
use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EditorNode {
    #[serde(rename = "type")]
    pub node_type: String,
    #[serde(default)]
    pub attributes: Option<serde_json::Value>,
    #[serde(default)]
    pub children: Option<Vec<EditorNode>>,
    #[serde(default)]
    pub text: Option<String>,
    #[serde(default)]
    pub id: Option<String>,
}

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
pub struct DocumentMetadata {
    pub word_count: u32,
    pub character_count: u32,
    pub seqta_references: Vec<SeqtaReference>,
    #[serde(default)]
    pub created_at: Option<String>,
    #[serde(default)]
    pub updated_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EditorDocument {
    pub version: String,
    pub nodes: Vec<EditorNode>,
    pub metadata: DocumentMetadata,
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
    pub content: EditorDocument,
    pub folder_path: Vec<String>,
    pub tags: Vec<String>,
    pub seqta_references: Vec<SeqtaReference>,
    pub created_at: String,
    pub updated_at: String,
    pub last_accessed: String,
    pub metadata: NoteMetadata,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NoteFolder {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub parent_id: Option<String>,
    #[serde(default)]
    pub color: Option<String>,
    #[serde(default)]
    pub icon: Option<String>,
    pub auto_generated: bool, // true for SEQTA-synced folders
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NotesSettings {
    pub auto_save_interval: u32, // seconds
    pub default_folder: String,
    pub backup_enabled: bool,
    pub max_backups: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NotesDatabase {
    pub notes: Vec<Note>,
    pub folders: Vec<NoteFolder>,
    pub settings: NotesSettings,
    pub version: String,
}

impl Default for NotesDatabase {
    fn default() -> Self {
        Self {
            notes: Vec::new(),
            folders: vec![
                NoteFolder {
                    id: "default".to_string(),
                    name: "My Notes".to_string(),
                    parent_id: None,
                    color: None,
                    icon: Some("📝".to_string()),
                    auto_generated: false,
                    created_at: chrono::Utc::now().to_rfc3339(),
                    updated_at: chrono::Utc::now().to_rfc3339(),
                }
            ],
            settings: NotesSettings {
                auto_save_interval: 30,
                default_folder: "default".to_string(),
                backup_enabled: true,
                max_backups: 10,
            },
            version: "1.0".to_string(),
        }
    }
}

/// Location strategy mirrors settings.rs and todolist.rs:
/// - Android: /data/data/com.desqta.app/files/DesQTA/notes.json
/// - Other platforms: <OS data dir>/DesQTA/notes.json
fn notes_file_path(_app: &AppHandle) -> Result<PathBuf, String> {
    #[cfg(target_os = "android")]
    {
        let mut dir = PathBuf::from("/data/data/com.desqta.app/files");
        dir.push("DesQTA");
        if !dir.exists() {
            fs::create_dir_all(&dir).map_err(|e| format!("Failed to create data dir: {}", e))?;
        }
        dir.push("notes.json");
        Ok(dir)
    }
    #[cfg(not(target_os = "android"))]
    {
        let mut dir = dirs_next::data_dir().ok_or_else(|| "Unable to determine data dir".to_string())?;
        dir.push("DesQTA");
        if !dir.exists() {
            fs::create_dir_all(&dir).map_err(|e| format!("Failed to create data dir: {}", e))?;
        }
        dir.push("notes.json");
        Ok(dir)
    }
}

fn ensure_parent_dir(path: &PathBuf) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Failed to create data dir: {}", e))?;
    }
    Ok(())
}

fn load_notes_database(app: &AppHandle) -> Result<NotesDatabase, String> {
    let path = notes_file_path(app)?;
    if !path.exists() {
        return Ok(NotesDatabase::default());
    }
    
    let mut file = File::open(&path).map_err(|e| format!("Failed to open notes file: {}", e))?;
    let mut contents = String::new();
    file.read_to_string(&mut contents)
        .map_err(|e| format!("Failed to read notes file: {}", e))?;
    
    if contents.trim().is_empty() {
        return Ok(NotesDatabase::default());
    }
    
    let database: NotesDatabase = serde_json::from_str(&contents)
        .map_err(|e| format!("Failed to parse notes JSON: {}", e))?;
    
    Ok(database)
}

fn save_notes_database(app: &AppHandle, database: &NotesDatabase) -> Result<(), String> {
    let path = notes_file_path(app)?;
    ensure_parent_dir(&path)?;
    
    let json = serde_json::to_string_pretty(database)
        .map_err(|e| format!("Failed to serialize notes database: {}", e))?;
    
    let mut file = File::create(&path).map_err(|e| format!("Failed to create notes file: {}", e))?;
    file.write_all(json.as_bytes())
        .map_err(|e| format!("Failed to write notes file: {}", e))?;
    
    Ok(())
}

// Tauri Commands

#[tauri::command]
pub fn load_notes(app: AppHandle) -> Result<Vec<Note>, String> {
    let database = load_notes_database(&app)?;
    Ok(database.notes)
}

#[tauri::command]
pub fn save_note(app: AppHandle, note: Note) -> Result<(), String> {
    let mut database = load_notes_database(&app)?;
    
    // Find existing note or add new one
    if let Some(existing_index) = database.notes.iter().position(|n| n.id == note.id) {
        database.notes[existing_index] = note;
    } else {
        database.notes.push(note);
    }
    
    save_notes_database(&app, &database)?;
    Ok(())
}

#[tauri::command]
pub fn delete_note(app: AppHandle, note_id: String) -> Result<(), String> {
    let mut database = load_notes_database(&app)?;
    database.notes.retain(|note| note.id != note_id);
    save_notes_database(&app, &database)?;
    Ok(())
}

#[tauri::command]
pub fn get_note(app: AppHandle, note_id: String) -> Result<Option<Note>, String> {
    let database = load_notes_database(&app)?;
    Ok(database.notes.into_iter().find(|note| note.id == note_id))
}

#[tauri::command]
pub fn search_notes(app: AppHandle, query: String) -> Result<Vec<Note>, String> {
    let database = load_notes_database(&app)?;
    let query_lower = query.to_lowercase();
    
    let matching_notes: Vec<Note> = database.notes
        .into_iter()
        .filter(|note| {
            note.title.to_lowercase().contains(&query_lower) ||
            note.tags.iter().any(|tag| tag.to_lowercase().contains(&query_lower)) ||
            // Search in content text (simplified)
            note.content.nodes.iter().any(|node| {
                node.text.as_ref().map_or(false, |text| text.to_lowercase().contains(&query_lower))
            })
        })
        .collect();
    
    Ok(matching_notes)
}

// Folder management

#[tauri::command]
pub fn load_folders(app: AppHandle) -> Result<Vec<NoteFolder>, String> {
    let database = load_notes_database(&app)?;
    Ok(database.folders)
}

#[tauri::command]
pub fn create_folder(app: AppHandle, folder: NoteFolder) -> Result<String, String> {
    let mut database = load_notes_database(&app)?;
    
    // Check if folder ID already exists
    if database.folders.iter().any(|f| f.id == folder.id) {
        return Err("Folder with this ID already exists".to_string());
    }
    
    let folder_id = folder.id.clone();
    database.folders.push(folder);
    save_notes_database(&app, &database)?;
    
    Ok(folder_id)
}

#[tauri::command]
pub fn delete_folder(app: AppHandle, folder_id: String) -> Result<(), String> {
    let mut database = load_notes_database(&app)?;
    
    // Don't allow deleting the default folder
    if folder_id == "default" {
        return Err("Cannot delete the default folder".to_string());
    }
    
    // Move notes from deleted folder to default
    for note in &mut database.notes {
        if note.folder_path.contains(&folder_id) {
            note.folder_path = vec!["default".to_string()];
            note.updated_at = chrono::Utc::now().to_rfc3339();
        }
    }
    
    // Remove the folder
    database.folders.retain(|folder| folder.id != folder_id);
    save_notes_database(&app, &database)?;
    
    Ok(())
}

#[tauri::command]
pub fn move_note_to_folder(app: AppHandle, note_id: String, folder_id: String) -> Result<(), String> {
    let mut database = load_notes_database(&app)?;
    
    // Verify folder exists
    if !database.folders.iter().any(|f| f.id == folder_id) {
        return Err("Target folder does not exist".to_string());
    }
    
    // Find and update note
    if let Some(note) = database.notes.iter_mut().find(|n| n.id == note_id) {
        note.folder_path = vec![folder_id];
        note.updated_at = chrono::Utc::now().to_rfc3339();
    } else {
        return Err("Note not found".to_string());
    }
    
    save_notes_database(&app, &database)?;
    Ok(())
}

// Utility functions

#[tauri::command]
pub fn get_notes_stats(app: AppHandle) -> Result<serde_json::Value, String> {
    let database = load_notes_database(&app)?;
    
    let total_notes = database.notes.len();
    let total_words: u32 = database.notes.iter().map(|n| n.metadata.word_count).sum();
    let total_folders = database.folders.len();
    
    let stats = serde_json::json!({
        "total_notes": total_notes,
        "total_words": total_words,
        "total_folders": total_folders,
        "database_version": database.version
    });
    
    Ok(stats)
}

#[tauri::command]
pub fn backup_notes(app: AppHandle) -> Result<String, String> {
    let database = load_notes_database(&app)?;
    let timestamp = chrono::Utc::now().format("%Y%m%d_%H%M%S");
    
    #[cfg(target_os = "android")]
    let backup_dir = PathBuf::from("/data/data/com.desqta.app/files/DesQTA/backups");
    #[cfg(not(target_os = "android"))]
    let backup_dir = dirs_next::data_dir()
        .ok_or_else(|| "Unable to determine data dir".to_string())?
        .join("DesQTA")
        .join("backups");
    
    if !backup_dir.exists() {
        fs::create_dir_all(&backup_dir).map_err(|e| format!("Failed to create backup dir: {}", e))?;
    }
    
    let backup_file = backup_dir.join(format!("notes_backup_{}.json", timestamp));
    let json = serde_json::to_string_pretty(&database)
        .map_err(|e| format!("Failed to serialize backup: {}", e))?;
    
    let mut file = File::create(&backup_file).map_err(|e| format!("Failed to create backup file: {}", e))?;
    file.write_all(json.as_bytes())
        .map_err(|e| format!("Failed to write backup file: {}", e))?;
    
    Ok(backup_file.to_string_lossy().to_string())
}

#[tauri::command]
pub fn restore_notes_from_backup(app: AppHandle, backup_path: String) -> Result<(), String> {
    let backup_file = PathBuf::from(backup_path);
    if !backup_file.exists() {
        return Err("Backup file does not exist".to_string());
    }
    
    let mut file = File::open(&backup_file).map_err(|e| format!("Failed to open backup file: {}", e))?;
    let mut contents = String::new();
    file.read_to_string(&mut contents)
        .map_err(|e| format!("Failed to read backup file: {}", e))?;
    
    let database: NotesDatabase = serde_json::from_str(&contents)
        .map_err(|e| format!("Failed to parse backup JSON: {}", e))?;
    
    save_notes_database(&app, &database)?;
    Ok(())
} 