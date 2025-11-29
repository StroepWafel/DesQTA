use anyhow::{Context, Result};
use chrono::Utc;
use rusqlite::{params, Connection, Result as SqlResult};
use serde_json::Value;
use std::fs;
use std::sync::{Mutex, OnceLock};
use tauri::AppHandle;

// Global database connection pool (single connection for now)
static DB: OnceLock<Mutex<Connection>> = OnceLock::new();

/// Initialize the database connection
pub fn init_database(_app: &AppHandle) -> Result<()> {
    // Use the same data directory logic as other modules
    #[cfg(target_os = "android")]
    {
        let mut dir =
            dirs_next::data_dir().ok_or_else(|| anyhow::anyhow!("Unable to determine data dir"))?;
        dir.push("DesQTA");
        if !dir.exists() {
            fs::create_dir_all(&dir).context("Failed to create DesQTA data directory")?;
        }
        let db_path = dir.join("desqta.db");

        let conn = Connection::open(&db_path).context("Failed to open database")?;

        init_schema(&conn)?;
        DB.set(Mutex::new(conn))
            .map_err(|_| anyhow::anyhow!("Database already initialized"))?;
    }

    #[cfg(not(target_os = "android"))]
    {
        let mut dir =
            dirs_next::data_dir().ok_or_else(|| anyhow::anyhow!("Unable to determine data dir"))?;
        dir.push("DesQTA");
        if !dir.exists() {
            fs::create_dir_all(&dir).context("Failed to create DesQTA data directory")?;
        }
        let db_path = dir.join("desqta.db");

        let conn = Connection::open(&db_path).context("Failed to open database")?;

        init_schema(&conn)?;
        DB.set(Mutex::new(conn))
            .map_err(|_| anyhow::anyhow!("Database already initialized"))?;
    }

    Ok(())
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

/// Get database connection
fn get_conn() -> Result<std::sync::MutexGuard<'static, Connection>> {
    let db = DB
        .get()
        .ok_or_else(|| anyhow::anyhow!("Database not initialized"))?;
    Ok(db.lock().unwrap())
}

// ========== Cache Operations ==========

#[tauri::command]
pub fn db_cache_get(key: String) -> Result<Option<Value>, String> {
    let mut conn_guard = get_conn().map_err(|e| e.to_string())?;
    let conn = &mut *conn_guard;

    let now = Utc::now().timestamp();

    let mut stmt = conn
        .prepare("SELECT value FROM cache WHERE key = ? AND (expires_at IS NULL OR expires_at > ?)")
        .map_err(|e| e.to_string())?;

    let result: SqlResult<String> = stmt.query_row(params![key, now], |row| row.get(0));

    match result {
        Ok(value_str) => {
            let value: Value = serde_json::from_str(&value_str)
                .map_err(|e| format!("Failed to parse JSON: {}", e))?;
            Ok(Some(value))
        }
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
pub fn db_cache_set(key: String, value: Value, ttl_minutes: Option<i64>) -> Result<(), String> {
    let mut conn_guard = get_conn().map_err(|e| e.to_string())?;
    let conn = &mut *conn_guard;

    let value_str =
        serde_json::to_string(&value).map_err(|e| format!("Failed to serialize JSON: {}", e))?;

    let now = Utc::now().timestamp();
    let expires_at = ttl_minutes.map(|ttl| now + (ttl * 60));

    conn.execute(
        "INSERT OR REPLACE INTO cache (key, value, created_at, expires_at) VALUES (?1, ?2, ?3, ?4)",
        params![key, value_str, now, expires_at],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn db_cache_delete(key: String) -> Result<(), String> {
    let mut conn_guard = get_conn().map_err(|e| e.to_string())?;
    let conn = &mut *conn_guard;

    conn.execute("DELETE FROM cache WHERE key = ?", params![key])
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn db_cache_clear() -> Result<(), String> {
    let mut conn_guard = get_conn().map_err(|e| e.to_string())?;
    let conn = &mut *conn_guard;

    conn.execute("DELETE FROM cache", [])
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn db_cache_cleanup_expired() -> Result<(), String> {
    let mut conn_guard = get_conn().map_err(|e| e.to_string())?;
    let conn = &mut *conn_guard;

    cleanup_expired_cache(conn).map_err(|e| e.to_string())?;

    Ok(())
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
    let mut conn_guard = get_conn().map_err(|e| e.to_string())?;
    let conn = &mut *conn_guard;

    let payload_str =
        serde_json::to_string(&payload).map_err(|e| format!("Failed to serialize JSON: {}", e))?;

    let now = Utc::now().timestamp();

    conn.execute(
        "INSERT INTO sync_queue (type, payload, created_at) VALUES (?1, ?2, ?3)",
        params![item_type, payload_str, now],
    )
    .map_err(|e| e.to_string())?;

    let id = conn.last_insert_rowid();
    Ok(id)
}

#[tauri::command]
pub fn db_queue_all() -> Result<Vec<QueueItem>, String> {
    let mut conn_guard = get_conn().map_err(|e| e.to_string())?;
    let conn = &mut *conn_guard;

    let mut stmt = conn
        .prepare("SELECT id, type, payload, created_at FROM sync_queue ORDER BY created_at ASC")
        .map_err(|e| e.to_string())?;

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
        .map_err(|e| e.to_string())?;

    let mut items = Vec::new();
    for row in rows {
        items.push(row.map_err(|e| e.to_string())?);
    }

    Ok(items)
}

#[tauri::command]
pub fn db_queue_delete(id: i64) -> Result<(), String> {
    let mut conn_guard = get_conn().map_err(|e| e.to_string())?;
    let conn = &mut *conn_guard;

    conn.execute("DELETE FROM sync_queue WHERE id = ?", params![id])
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn db_queue_clear() -> Result<(), String> {
    let mut conn_guard = get_conn().map_err(|e| e.to_string())?;
    let conn = &mut *conn_guard;

    conn.execute("DELETE FROM sync_queue", [])
        .map_err(|e| e.to_string())?;

    Ok(())
}

// ========== Structured Data Operations (for future use) ==========

#[tauri::command]
pub fn db_get_assessments_by_year(year: Option<i32>) -> Result<Vec<Value>, String> {
    let mut conn_guard = get_conn().map_err(|e| e.to_string())?;
    let conn = &mut *conn_guard;

    let mut results = Vec::new();

    if let Some(y) = year {
        let mut stmt = conn
            .prepare("SELECT data FROM assessments WHERE year = ? ORDER BY due DESC")
            .map_err(|e| e.to_string())?;
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
            .map_err(|e| e.to_string())?;

        for row in rows {
            results.push(row.map_err(|e| e.to_string())?);
        }
    } else {
        let mut stmt = conn
            .prepare("SELECT data FROM assessments ORDER BY due DESC")
            .map_err(|e| e.to_string())?;
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
            .map_err(|e| e.to_string())?;

        for row in rows {
            results.push(row.map_err(|e| e.to_string())?);
        }
    }

    Ok(results)
}
