use std::sync::Mutex;

use rusqlite::Connection;

/// Managed Tauri state holding the in-memory FTS5 SQLite connection.
pub struct FtsState(pub Mutex<Option<Connection>>);

/// Create a new in-memory SQLite database with an FTS5 virtual table.
pub fn create_fts_db() -> Result<Connection, rusqlite::Error> {
    let conn = Connection::open_in_memory()?;
    conn.execute_batch(
        "CREATE VIRTUAL TABLE IF NOT EXISTS fts_docs USING fts5(path, content, tokenize='unicode61');"
    )?;
    Ok(conn)
}


/// Rebuild the FTS index from pre-read (path, content) pairs. Avoids re-reading files from disk.
pub fn rebuild_fts_from_entries(conn: &Connection, entries: &[(String, String)]) -> Result<(), String> {
    conn.execute("DELETE FROM fts_docs", [])
        .map_err(|e| format!("Failed to clear FTS index: {}", e))?;
    for (rel_path, content) in entries {
        let _ = conn.execute(
            "INSERT INTO fts_docs(path, content) VALUES (?1, ?2)",
            rusqlite::params![rel_path, content],
        );
    }
    Ok(())
}

/// Update a single file in the FTS index.
pub fn update_file(conn: &Connection, rel_path: &str, content: &str) {
    let _ = conn.execute("DELETE FROM fts_docs WHERE path = ?1", rusqlite::params![rel_path]);
    let _ = conn.execute(
        "INSERT INTO fts_docs(path, content) VALUES (?1, ?2)",
        rusqlite::params![rel_path, content],
    );
}

/// Remove a file from the FTS index.
pub fn remove_file(conn: &Connection, rel_path: &str) {
    let _ = conn.execute("DELETE FROM fts_docs WHERE path = ?1", rusqlite::params![rel_path]);
}

/// Search the FTS index for matching file paths.
/// Returns a list of relative file paths that match the query.
/// For regex queries, returns None (caller should fall back to full scan).
pub fn search_fts(conn: &Connection, query: &str) -> Option<Vec<String>> {
    // Escape the query for FTS5 literal matching: wrap in double quotes
    // and escape internal double quotes by doubling them.
    let escaped = format!("\"{}\"", query.replace('"', "\"\""));

    let mut stmt = match conn.prepare("SELECT DISTINCT path FROM fts_docs WHERE fts_docs MATCH ?1") {
        Ok(s) => s,
        Err(_) => return None,
    };

    let rows = match stmt.query_map(rusqlite::params![escaped], |row| row.get::<_, String>(0)) {
        Ok(r) => r,
        Err(_) => return None,
    };

    Some(rows.filter_map(|r| r.ok()).collect())
}
