use anyhow::{Context, Result};
use chrono::Utc;
use rusqlite::{params, Connection, Result as SqlResult, OptionalExtension};
use serde_json::Value;
use std::sync::Mutex;
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::AppHandle;
use crate::profiles;
use crate::logger;
use crate::settings::Settings;

// Global database connection (allows reinitialization for profile switching)
static DB: Mutex<Option<Connection>> = Mutex::new(None);
static DB_INITIALIZED: AtomicBool = AtomicBool::new(false);

/// Initialize the database connection
pub fn init_database(_app: &AppHandle) -> Result<()> {
    // Get current profile ID or use "default"
    let profile_id = profiles::ProfileManager::get_current_profile()
        .map(|p| p.id)
        .unwrap_or_else(|| "default".to_string());
    
    // Get profile directory
    let profile_dir = profiles::get_profile_dir(&profile_id);
    let db_path = profile_dir.join("desqta.db");

    let conn = Connection::open(&db_path).context("Failed to open database")?;

    init_schema(&conn)?;
    
    // Close old connection if exists and set new one
    let mut db_guard = DB.lock().unwrap();
    if let Some(old_conn) = db_guard.take() {
        // Old connection will be dropped here
        drop(old_conn);
    }
    *db_guard = Some(conn);
    DB_INITIALIZED.store(true, Ordering::Release);

    if let Some(logger) = logger::get_logger() {
        let _ = logger.log(
            logger::LogLevel::INFO,
            "database",
            "init_database",
            "Database initialized for profile",
            serde_json::json!({"profile_id": profile_id, "db_path": db_path.to_string_lossy()}),
        );
    }

    Ok(())
}

/// Reinitialize database connection (for profile switching)
pub fn reinit_database(app: &AppHandle) -> Result<()> {
    // Close current connection
    {
        let mut db_guard = DB.lock().unwrap();
        if let Some(conn) = db_guard.take() {
            drop(conn);
        }
        DB_INITIALIZED.store(false, Ordering::Release);
    }
    
    // Reinitialize with new profile
    init_database(app)
}

/// Initialize database schema
fn init_schema(conn: &Connection) -> SqlResult<()> {
    // Cache table: key-value store for cached data
    conn.execute(
        "CREATE TABLE IF NOT EXISTS cache (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            expires_at INTEGER
        )",
        [],
    )?;

    // Create index on expires_at for cleanup queries
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_cache_expires_at ON cache(expires_at)",
        [],
    )?;

    // Sync queue table: for offline operations
    conn.execute(
        "CREATE TABLE IF NOT EXISTS sync_queue (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            type TEXT NOT NULL,
            payload TEXT NOT NULL,
            created_at INTEGER NOT NULL
        )",
        [],
    )?;

    // Create index on type for filtering
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_sync_queue_type ON sync_queue(type)",
        [],
    )?;

    // Create index on created_at for ordering
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_sync_queue_created_at ON sync_queue(created_at)",
        [],
    )?;

    // Assessments table: structured storage for assessments
    conn.execute(
        "CREATE TABLE IF NOT EXISTS assessments (
            id INTEGER PRIMARY KEY,
            code TEXT NOT NULL,
            title TEXT NOT NULL,
            due TEXT NOT NULL,
            year INTEGER,
            metaclass TEXT,
            colour TEXT,
            data TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        )",
        [],
    )?;

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_assessments_code ON assessments(code)",
        [],
    )?;

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_assessments_year ON assessments(year)",
        [],
    )?;

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_assessments_due ON assessments(due)",
        [],
    )?;

    // Courses table: structured storage for course data
    conn.execute(
        "CREATE TABLE IF NOT EXISTS courses (
            programme INTEGER NOT NULL,
            metaclass INTEGER NOT NULL,
            course_code TEXT NOT NULL,
            title TEXT,
            document TEXT,
            data TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            PRIMARY KEY (programme, metaclass)
        )",
        [],
    )?;

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_courses_code ON courses(course_code)",
        [],
    )?;

    // Timetable table: structured storage for timetable entries
    conn.execute(
        "CREATE TABLE IF NOT EXISTS timetable (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT NOT NULL,
            data TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        )",
        [],
    )?;

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_timetable_date ON timetable(date)",
        [],
    )?;

    // Notices table: structured storage for notices
    conn.execute(
        "CREATE TABLE IF NOT EXISTS notices (
            id INTEGER PRIMARY KEY,
            label_id INTEGER,
            date TEXT NOT NULL,
            data TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        )",
        [],
    )?;

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_notices_label_id ON notices(label_id)",
        [],
    )?;

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_notices_date ON notices(date)",
        [],
    )?;

    // Forum photos table: cache for forum user photos
    conn.execute(
        "CREATE TABLE IF NOT EXISTS forum_photos (
            uuid TEXT PRIMARY KEY,
            file_path TEXT NOT NULL,
            name TEXT,
            cached_at INTEGER NOT NULL
        )",
        [],
    )?;
    
    // Add name column if it doesn't exist (migration for existing databases)
    conn.execute(
        "ALTER TABLE forum_photos ADD COLUMN name TEXT",
        [],
    ).ok(); // Ignore error if column already exists
    
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_forum_photos_cached_at ON forum_photos(cached_at)",
        [],
    )?;
    
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_forum_photos_name ON forum_photos(name)",
        [],
    )?;

    // Search history table: stores search queries
    conn.execute(
        "CREATE TABLE IF NOT EXISTS search_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            query TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            use_count INTEGER DEFAULT 1
        )",
        [],
    )?;

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_search_history_query ON search_history(query)",
        [],
    )?;

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_search_history_created_at ON search_history(created_at)",
        [],
    )?;

    // Search favorites table: stores favorite search items
    conn.execute(
        "CREATE TABLE IF NOT EXISTS search_favorites (
            item_id TEXT PRIMARY KEY,
            created_at INTEGER NOT NULL
        )",
        [],
    )?;

    // Search recent items table: stores recently accessed search items
    conn.execute(
        "CREATE TABLE IF NOT EXISTS search_recent_items (
            item_id TEXT PRIMARY KEY,
            item_data TEXT NOT NULL,
            last_used INTEGER NOT NULL,
            use_count INTEGER DEFAULT 1
        )",
        [],
    )?;

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_search_recent_last_used ON search_recent_items(last_used)",
        [],
    )?;

    // Search usage tracking table: tracks item usage statistics
    conn.execute(
        "CREATE TABLE IF NOT EXISTS search_usage (
            item_id TEXT NOT NULL,
            category TEXT NOT NULL,
            used_at INTEGER NOT NULL,
            PRIMARY KEY (item_id, used_at)
        )",
        [],
    )?;

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_search_usage_item_id ON search_usage(item_id)",
        [],
    )?;

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_search_usage_category ON search_usage(category)",
        [],
    )?;

    // Notifications table: stores scheduled OS notifications for assessments
    conn.execute(
        "CREATE TABLE IF NOT EXISTS notifications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            assessment_id INTEGER NOT NULL,
            notification_type TEXT NOT NULL,
            scheduled_for INTEGER NOT NULL,
            sent_at INTEGER,
            created_at INTEGER NOT NULL,
            UNIQUE(assessment_id, notification_type)
        )",
        [],
    )?;

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_notifications_scheduled_for ON notifications(scheduled_for)",
        [],
    )?;

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_notifications_assessment_id ON notifications(assessment_id)",
        [],
    )?;

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_notifications_sent_at ON notifications(sent_at)",
        [],
    )?;

    // Widget layouts table: stores dashboard widget configurations
    conn.execute(
        "CREATE TABLE IF NOT EXISTS widget_layouts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            widget_id TEXT NOT NULL,
            widget_type TEXT NOT NULL,
            position_x INTEGER NOT NULL,
            position_y INTEGER NOT NULL,
            position_w INTEGER NOT NULL,
            position_h INTEGER NOT NULL,
            position_min_w INTEGER,
            position_min_h INTEGER,
            position_max_w INTEGER,
            position_max_h INTEGER,
            enabled INTEGER NOT NULL DEFAULT 1,
            settings TEXT,
            title TEXT,
            layout_version INTEGER NOT NULL DEFAULT 1,
            last_modified INTEGER NOT NULL,
            UNIQUE(widget_id, layout_version)
        )",
        [],
    )?;

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_widget_layouts_widget_id ON widget_layouts(widget_id)",
        [],
    )?;

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_widget_layouts_type ON widget_layouts(widget_type)",
        [],
    )?;

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_widget_layouts_version ON widget_layouts(layout_version)",
        [],
    )?;

    // Clean up expired cache entries
    cleanup_expired_cache(conn)?;

    Ok(())
}

/// Clean up expired cache entries
fn cleanup_expired_cache(conn: &Connection) -> SqlResult<()> {
    let now = Utc::now().timestamp();
    conn.execute(
        "DELETE FROM cache WHERE expires_at IS NOT NULL AND expires_at < ?",
        params![now],
    )?;
    Ok(())
}

/// Get database connection (helper to access the connection)
pub fn with_conn<F, R>(f: F) -> Result<R>
where
    F: FnOnce(&mut Connection) -> Result<R>,
{
    if !DB_INITIALIZED.load(Ordering::Acquire) {
        return Err(anyhow::anyhow!("Database not initialized"));
    }
    
    let mut db_guard = DB.lock().unwrap();
    let conn = db_guard.as_mut()
        .ok_or_else(|| anyhow::anyhow!("Database connection is None"))?;
    
    f(conn)
}

// ========== Cache Operations ==========

#[tauri::command]
pub fn db_cache_get(key: String) -> Result<Option<Value>, String> {
    let now = Utc::now().timestamp();
    
    with_conn(|conn| {
        let mut stmt = conn
            .prepare("SELECT value FROM cache WHERE key = ? AND (expires_at IS NULL OR expires_at > ?)")
            .map_err(|e| anyhow::anyhow!("Failed to prepare statement: {}", e))?;

        let result: SqlResult<String> = stmt.query_row(params![key, now], |row| row.get(0));

        match result {
            Ok(value_str) => {
                let value: Value = serde_json::from_str(&value_str)
                    .map_err(|e| anyhow::anyhow!("Failed to parse JSON: {}", e))?;
                Ok(Some(value))
            }
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(anyhow::anyhow!("Query error: {}", e)),
        }
    }).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_cache_set(key: String, value: Value, ttl_minutes: Option<i64>) -> Result<(), String> {
    let value_str =
        serde_json::to_string(&value).map_err(|e| format!("Failed to serialize JSON: {}", e))?;

    let now = Utc::now().timestamp();
    let expires_at = ttl_minutes.map(|ttl| now + (ttl * 60));

    with_conn(|conn| {
        conn.execute(
            "INSERT OR REPLACE INTO cache (key, value, created_at, expires_at) VALUES (?1, ?2, ?3, ?4)",
            params![key, value_str, now, expires_at],
        )
        .map_err(|e| anyhow::anyhow!("Failed to execute: {}", e))?;
        Ok(())
    }).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_cache_delete(key: String) -> Result<(), String> {
    with_conn(|conn| {
        conn.execute("DELETE FROM cache WHERE key = ?", params![key])
            .map_err(|e| anyhow::anyhow!("Failed to execute: {}", e))?;
        Ok(())
    }).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_cache_clear() -> Result<(), String> {
    with_conn(|conn| {
        conn.execute("DELETE FROM cache", [])
            .map_err(|e| anyhow::anyhow!("Failed to execute: {}", e))?;
        Ok(())
    }).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_cache_cleanup_expired() -> Result<(), String> {
    with_conn(|conn| {
        cleanup_expired_cache(conn)
            .map_err(|e| anyhow::anyhow!("Failed to cleanup: {}", e))?;
        Ok(())
    }).map_err(|e| e.to_string())
}

// ========== Sync Queue Operations ==========

#[derive(serde::Serialize, serde::Deserialize)]
pub struct QueueItem {
    pub id: Option<i64>,
    #[serde(rename = "type")]
    pub item_type: String,
    pub payload: Value,
    pub created_at: i64,
}

#[tauri::command]
pub fn db_queue_add(item_type: String, payload: Value) -> Result<i64, String> {
    let payload_str =
        serde_json::to_string(&payload).map_err(|e| format!("Failed to serialize JSON: {}", e))?;

    let now = Utc::now().timestamp();

    with_conn(|conn| {
        conn.execute(
            "INSERT INTO sync_queue (type, payload, created_at) VALUES (?1, ?2, ?3)",
            params![item_type, payload_str, now],
        )
        .map_err(|e| anyhow::anyhow!("Failed to execute: {}", e))?;

        let id = conn.last_insert_rowid();
        Ok(id)
    }).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_queue_all() -> Result<Vec<QueueItem>, String> {
    with_conn(|conn| {
        let mut stmt = conn
            .prepare("SELECT id, type, payload, created_at FROM sync_queue ORDER BY created_at ASC")
            .map_err(|e| anyhow::anyhow!("Failed to prepare statement: {}", e))?;

        let rows = stmt
            .query_map([], |row| {
                Ok(QueueItem {
                    id: Some(row.get(0)?),
                    item_type: row.get(1)?,
                    payload: {
                        let payload_str: String = row.get(2)?;
                        serde_json::from_str(&payload_str).map_err(|_| {
                            rusqlite::Error::InvalidColumnType(
                                2,
                                "TEXT".to_string(),
                                rusqlite::types::Type::Text,
                            )
                        })
                    }?,
                    created_at: row.get(3)?,
                })
            })
            .map_err(|e| anyhow::anyhow!("Query error: {}", e))?;

        let mut items = Vec::new();
        for row in rows {
            items.push(row.map_err(|e| anyhow::anyhow!("Row error: {}", e))?);
        }

        Ok(items)
    }).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_queue_delete(id: i64) -> Result<(), String> {
    with_conn(|conn| {
        conn.execute("DELETE FROM sync_queue WHERE id = ?", params![id])
            .map_err(|e| anyhow::anyhow!("Failed to execute: {}", e))?;
        Ok(())
    }).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_queue_clear() -> Result<(), String> {
    with_conn(|conn| {
        conn.execute("DELETE FROM sync_queue", [])
            .map_err(|e| anyhow::anyhow!("Failed to execute: {}", e))?;
        Ok(())
    }).map_err(|e| e.to_string())
}

// ========== Search Data Operations ==========

#[tauri::command]
pub fn db_search_history_get(limit: Option<i32>) -> Result<Vec<String>, String> {
    let limit = limit.unwrap_or(10);
    with_conn(|conn| {
        let mut stmt = conn
            .prepare("SELECT query FROM search_history ORDER BY created_at DESC, use_count DESC LIMIT ?")
            .map_err(|e| anyhow::anyhow!("Failed to prepare statement: {}", e))?;

        let rows = stmt
            .query_map(params![limit], |row| {
                Ok(row.get::<_, String>(0)?)
            })
            .map_err(|e| anyhow::anyhow!("Query error: {}", e))?;

        let mut results = Vec::new();
        for row in rows {
            results.push(row.map_err(|e| anyhow::anyhow!("Row error: {}", e))?);
        }

        Ok(results)
    }).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_search_history_add(query: String) -> Result<(), String> {
    let now = Utc::now().timestamp();
    with_conn(|conn| {
        // Check if query exists
        let exists: bool = conn
            .query_row(
                "SELECT EXISTS(SELECT 1 FROM search_history WHERE query = ?)",
                params![query],
                |row| row.get(0),
            )
            .unwrap_or(false);

        if exists {
            // Update use_count and created_at
            conn.execute(
                "UPDATE search_history SET use_count = use_count + 1, created_at = ? WHERE query = ?",
                params![now, query],
            )
            .map_err(|e| anyhow::anyhow!("Failed to update: {}", e))?;
        } else {
            // Insert new query
            conn.execute(
                "INSERT INTO search_history (query, created_at, use_count) VALUES (?1, ?2, 1)",
                params![query, now],
            )
            .map_err(|e| anyhow::anyhow!("Failed to insert: {}", e))?;
        }

        Ok(())
    }).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_search_history_clear() -> Result<(), String> {
    with_conn(|conn| {
        conn.execute("DELETE FROM search_history", [])
            .map_err(|e| anyhow::anyhow!("Failed to execute: {}", e))?;
        Ok(())
    }).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_search_favorites_get() -> Result<Vec<String>, String> {
    with_conn(|conn| {
        let mut stmt = conn
            .prepare("SELECT item_id FROM search_favorites ORDER BY created_at DESC")
            .map_err(|e| anyhow::anyhow!("Failed to prepare statement: {}", e))?;

        let rows = stmt
            .query_map([], |row| {
                Ok(row.get::<_, String>(0)?)
            })
            .map_err(|e| anyhow::anyhow!("Query error: {}", e))?;

        let mut results = Vec::new();
        for row in rows {
            results.push(row.map_err(|e| anyhow::anyhow!("Row error: {}", e))?);
        }

        Ok(results)
    }).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_search_favorites_add(item_id: String) -> Result<(), String> {
    let now = Utc::now().timestamp();
    with_conn(|conn| {
        conn.execute(
            "INSERT OR IGNORE INTO search_favorites (item_id, created_at) VALUES (?1, ?2)",
            params![item_id, now],
        )
        .map_err(|e| anyhow::anyhow!("Failed to insert: {}", e))?;
        Ok(())
    }).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_search_favorites_remove(item_id: String) -> Result<(), String> {
    with_conn(|conn| {
        conn.execute("DELETE FROM search_favorites WHERE item_id = ?", params![item_id])
            .map_err(|e| anyhow::anyhow!("Failed to execute: {}", e))?;
        Ok(())
    }).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_search_recent_get(limit: Option<i32>) -> Result<Vec<Value>, String> {
    let limit = limit.unwrap_or(5);
    with_conn(|conn| {
        let mut stmt = conn
            .prepare("SELECT item_data FROM search_recent_items ORDER BY last_used DESC LIMIT ?")
            .map_err(|e| anyhow::anyhow!("Failed to prepare statement: {}", e))?;

        let rows = stmt
            .query_map(params![limit], |row| {
                let data_str: String = row.get(0)?;
                serde_json::from_str::<Value>(&data_str).map_err(|_| {
                    rusqlite::Error::InvalidColumnType(
                        0,
                        "TEXT".to_string(),
                        rusqlite::types::Type::Text,
                    )
                })
            })
            .map_err(|e| anyhow::anyhow!("Query error: {}", e))?;

        let mut results = Vec::new();
        for row in rows {
            results.push(row.map_err(|e| anyhow::anyhow!("Row error: {}", e))?);
        }

        Ok(results)
    }).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_search_recent_add(item_id: String, item_data: Value) -> Result<(), String> {
    let now = Utc::now().timestamp();
    let item_data_str = serde_json::to_string(&item_data)
        .map_err(|e| format!("Failed to serialize: {}", e))?;

    with_conn(|conn| {
        // Check if item exists
        let exists: bool = conn
            .query_row(
                "SELECT EXISTS(SELECT 1 FROM search_recent_items WHERE item_id = ?)",
                params![item_id],
                |row| row.get(0),
            )
            .unwrap_or(false);

        if exists {
            // Update last_used and use_count
            conn.execute(
                "UPDATE search_recent_items SET last_used = ?, use_count = use_count + 1, item_data = ? WHERE item_id = ?",
                params![now, item_data_str, item_id],
            )
            .map_err(|e| anyhow::anyhow!("Failed to update: {}", e))?;
        } else {
            // Insert new item
            conn.execute(
                "INSERT INTO search_recent_items (item_id, item_data, last_used, use_count) VALUES (?1, ?2, ?3, 1)",
                params![item_id, item_data_str, now],
            )
            .map_err(|e| anyhow::anyhow!("Failed to insert: {}", e))?;
        }

        // Keep only the most recent items (limit to 20)
        conn.execute(
            "DELETE FROM search_recent_items WHERE item_id NOT IN (
                SELECT item_id FROM search_recent_items ORDER BY last_used DESC LIMIT 20
            )",
            [],
        )
        .ok(); // Ignore errors

        Ok(())
    }).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_search_recent_clear() -> Result<(), String> {
    with_conn(|conn| {
        conn.execute("DELETE FROM search_recent_items", [])
            .map_err(|e| anyhow::anyhow!("Failed to execute: {}", e))?;
        Ok(())
    }).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_search_usage_track(item_id: String, category: String) -> Result<(), String> {
    let now = Utc::now().timestamp();
    with_conn(|conn| {
        conn.execute(
            "INSERT OR IGNORE INTO search_usage (item_id, category, used_at) VALUES (?1, ?2, ?3)",
            params![item_id, category, now],
        )
        .map_err(|e| anyhow::anyhow!("Failed to insert: {}", e))?;
        Ok(())
    }).map_err(|e| e.to_string())
}

// ========== Structured Data Operations (for future use) ==========

#[tauri::command]
pub fn db_search_assessments(query: String, limit: Option<i32>) -> Result<Vec<Value>, String> {
    let limit = limit.unwrap_or(5);
    let search_pattern = format!("%{}%", query);
    with_conn(|conn| {
        let mut stmt = conn
            .prepare(
                "SELECT data FROM assessments 
                WHERE title LIKE ?1 OR code LIKE ?1 
                ORDER BY due ASC 
                LIMIT ?2"
            )
            .map_err(|e| anyhow::anyhow!("Failed to prepare statement: {}", e))?;
        
        let rows = stmt
            .query_map(params![search_pattern, limit], |row| {
                let data_str: String = row.get(0)?;
                serde_json::from_str::<Value>(&data_str).map_err(|_| {
                    rusqlite::Error::InvalidColumnType(
                        0,
                        "TEXT".to_string(),
                        rusqlite::types::Type::Text,
                    )
                })
            })
            .map_err(|e| anyhow::anyhow!("Query error: {}", e))?;

        let mut results = Vec::new();
        for row in rows {
            results.push(row.map_err(|e| anyhow::anyhow!("Row error: {}", e))?);
        }

        Ok(results)
    }).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_search_courses(query: String, limit: Option<i32>) -> Result<Vec<Value>, String> {
    let limit = limit.unwrap_or(5);
    let search_pattern = format!("%{}%", query);
    with_conn(|conn| {
        let mut stmt = conn
            .prepare(
                "SELECT data FROM courses 
                WHERE title LIKE ?1 OR course_code LIKE ?1 
                ORDER BY updated_at DESC 
                LIMIT ?2"
            )
            .map_err(|e| anyhow::anyhow!("Failed to prepare statement: {}", e))?;
        
        let rows = stmt
            .query_map(params![search_pattern, limit], |row| {
                let data_str: String = row.get(0)?;
                serde_json::from_str::<Value>(&data_str).map_err(|_| {
                    rusqlite::Error::InvalidColumnType(
                        0,
                        "TEXT".to_string(),
                        rusqlite::types::Type::Text,
                    )
                })
            })
            .map_err(|e| anyhow::anyhow!("Query error: {}", e))?;

        let mut results = Vec::new();
        for row in rows {
            results.push(row.map_err(|e| anyhow::anyhow!("Row error: {}", e))?);
        }

        Ok(results)
    }).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_get_assessments_by_year(year: Option<i32>) -> Result<Vec<Value>, String> {
    with_conn(|conn| {
        let mut results = Vec::new();

        if let Some(y) = year {
            let mut stmt = conn
                .prepare("SELECT data FROM assessments WHERE year = ? ORDER BY due DESC")
                .map_err(|e| anyhow::anyhow!("Failed to prepare statement: {}", e))?;
            let rows = stmt
                .query_map(params![y], |row| {
                    let data_str: String = row.get(0)?;
                    serde_json::from_str::<Value>(&data_str).map_err(|_| {
                        rusqlite::Error::InvalidColumnType(
                            0,
                            "TEXT".to_string(),
                            rusqlite::types::Type::Text,
                        )
                    })
                })
                .map_err(|e| anyhow::anyhow!("Query error: {}", e))?;

            for row in rows {
                results.push(row.map_err(|e| anyhow::anyhow!("Row error: {}", e))?);
            }
        } else {
            let mut stmt = conn
                .prepare("SELECT data FROM assessments ORDER BY due DESC")
                .map_err(|e| anyhow::anyhow!("Failed to prepare statement: {}", e))?;
            let rows = stmt
                .query_map([], |row| {
                    let data_str: String = row.get(0)?;
                    serde_json::from_str::<Value>(&data_str).map_err(|_| {
                        rusqlite::Error::InvalidColumnType(
                            0,
                            "TEXT".to_string(),
                            rusqlite::types::Type::Text,
                        )
                    })
                })
                .map_err(|e| anyhow::anyhow!("Query error: {}", e))?;

            for row in rows {
                results.push(row.map_err(|e| anyhow::anyhow!("Row error: {}", e))?);
            }
        }

        Ok(results)
    }).map_err(|e| e.to_string())
}

// ========== Notification Operations ==========

#[derive(serde::Serialize, serde::Deserialize)]
pub struct Notification {
    pub id: i64,
    pub assessment_id: i64,
    pub notification_type: String,
    pub scheduled_for: i64,
    pub sent_at: Option<i64>,
    pub created_at: i64,
}

#[tauri::command]
pub fn db_notification_schedule(
    assessment_id: i64,
    notification_type: String,
    scheduled_for: i64,
) -> Result<i64, String> {
    let now = Utc::now().timestamp();
    
    with_conn(|conn| {
        // Use INSERT OR REPLACE to handle unique constraint
        conn.execute(
            "INSERT OR REPLACE INTO notifications (assessment_id, notification_type, scheduled_for, sent_at, created_at) 
             VALUES (?1, ?2, ?3, NULL, ?4)",
            params![assessment_id, notification_type, scheduled_for, now],
        )
        .map_err(|e| anyhow::anyhow!("Failed to execute: {}", e))?;

        let id = conn.last_insert_rowid();
        Ok(id)
    }).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_notification_get_due(now_timestamp: i64) -> Result<Vec<Notification>, String> {
    with_conn(|conn| {
        let mut stmt = conn
            .prepare(
                "SELECT id, assessment_id, notification_type, scheduled_for, sent_at, created_at 
                 FROM notifications 
                 WHERE scheduled_for <= ? AND sent_at IS NULL 
                 ORDER BY scheduled_for ASC"
            )
            .map_err(|e| anyhow::anyhow!("Failed to prepare statement: {}", e))?;

        let rows = stmt
            .query_map(params![now_timestamp], |row| {
                Ok(Notification {
                    id: row.get(0)?,
                    assessment_id: row.get(1)?,
                    notification_type: row.get(2)?,
                    scheduled_for: row.get(3)?,
                    sent_at: row.get(4)?,
                    created_at: row.get(5)?,
                })
            })
            .map_err(|e| anyhow::anyhow!("Query error: {}", e))?;

        let mut results = Vec::new();
        for row in rows {
            results.push(row.map_err(|e| anyhow::anyhow!("Row error: {}", e))?);
        }

        Ok(results)
    }).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_notification_mark_sent(notification_id: i64) -> Result<(), String> {
    let now = Utc::now().timestamp();
    
    with_conn(|conn| {
        conn.execute(
            "UPDATE notifications SET sent_at = ? WHERE id = ?",
            params![now, notification_id],
        )
        .map_err(|e| anyhow::anyhow!("Failed to execute: {}", e))?;
        Ok(())
    }).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_notification_get_by_assessment(assessment_id: i64) -> Result<Vec<Notification>, String> {
    with_conn(|conn| {
        let mut stmt = conn
            .prepare(
                "SELECT id, assessment_id, notification_type, scheduled_for, sent_at, created_at 
                 FROM notifications 
                 WHERE assessment_id = ? 
                 ORDER BY scheduled_for ASC"
            )
            .map_err(|e| anyhow::anyhow!("Failed to prepare statement: {}", e))?;

        let rows = stmt
            .query_map(params![assessment_id], |row| {
                Ok(Notification {
                    id: row.get(0)?,
                    assessment_id: row.get(1)?,
                    notification_type: row.get(2)?,
                    scheduled_for: row.get(3)?,
                    sent_at: row.get(4)?,
                    created_at: row.get(5)?,
                })
            })
            .map_err(|e| anyhow::anyhow!("Query error: {}", e))?;

        let mut results = Vec::new();
        for row in rows {
            results.push(row.map_err(|e| anyhow::anyhow!("Row error: {}", e))?);
        }

        Ok(results)
    }).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_notification_cleanup_old(days_to_keep: i64) -> Result<(), String> {
    let cutoff = Utc::now().timestamp() - (days_to_keep * 24 * 60 * 60);
    
    with_conn(|conn| {
        conn.execute(
            "DELETE FROM notifications WHERE sent_at IS NOT NULL AND sent_at < ?",
            params![cutoff],
        )
        .map_err(|e| anyhow::anyhow!("Failed to execute: {}", e))?;
        Ok(())
    }).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_notification_delete_by_assessment(assessment_id: i64) -> Result<(), String> {
    with_conn(|conn| {
        conn.execute(
            "DELETE FROM notifications WHERE assessment_id = ?",
            params![assessment_id],
        )
        .map_err(|e| anyhow::anyhow!("Failed to execute: {}", e))?;
        Ok(())
    }).map_err(|e| e.to_string())
}

// ========== Widget Layout Operations ==========

#[derive(Debug, serde::Serialize, serde::Deserialize, Clone)]
pub struct WidgetPosition {
    pub x: i32,
    pub y: i32,
    pub w: i32,
    pub h: i32,
    #[serde(default, rename = "minW", skip_serializing_if = "Option::is_none")]
    pub min_w: Option<i32>,
    #[serde(default, rename = "minH", skip_serializing_if = "Option::is_none")]
    pub min_h: Option<i32>,
    #[serde(default, rename = "maxW", skip_serializing_if = "Option::is_none")]
    pub max_w: Option<i32>,
    #[serde(default, rename = "maxH", skip_serializing_if = "Option::is_none")]
    pub max_h: Option<i32>,
}

#[derive(Debug, serde::Serialize, serde::Deserialize, Clone)]
pub struct WidgetConfig {
    pub id: String,
    #[serde(rename = "type")]
    pub widget_type: String,
    pub position: WidgetPosition,
    pub enabled: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub settings: Option<Value>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
}

#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct WidgetLayout {
    pub widgets: Vec<WidgetConfig>,
    pub version: i32,
    #[serde(rename = "lastModified")]
    pub last_modified: String, // ISO 8601 string
}

#[tauri::command]
pub fn db_widget_layout_save(layout: WidgetLayout) -> Result<(), String> {
    // Serialize layout to JSON string
    let json_str = serde_json::to_string(&layout)
        .map_err(|e| format!("Failed to serialize layout: {}", e))?;

    // Load current settings
    let mut settings = Settings::load();

    // Update widget layout field
    settings.dashboard_widgets_layout = Some(json_str);

    // Save settings
    settings
        .save()
        .map_err(|e| format!("Failed to save settings: {}", e))?;

    Ok(())
}

#[tauri::command]
pub fn db_widget_layout_load() -> Result<Option<WidgetLayout>, String> {
    // Load settings
    let settings = Settings::load();

    // Get widget layout JSON string
    let json_str = match settings.dashboard_widgets_layout {
        Some(s) => s,
        None => return Ok(None),
    };

    // Deserialize to WidgetLayout
    let layout: WidgetLayout = serde_json::from_str(&json_str)
        .map_err(|e| format!("Failed to deserialize layout: {}", e))?;

    Ok(Some(layout))
}
