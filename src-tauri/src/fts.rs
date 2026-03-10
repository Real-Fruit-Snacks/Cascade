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
        if let Err(e) = conn.execute(
            "INSERT INTO fts_docs(path, content) VALUES (?1, ?2)",
            rusqlite::params![rel_path, content],
        ) {
            eprintln!("[fts] warning: failed to insert '{rel_path}' into FTS index: {e}");
        }
    }
    Ok(())
}

/// Update a single file in the FTS index.
pub fn update_file(conn: &Connection, rel_path: &str, content: &str) {
    if let Err(e) = conn.execute("DELETE FROM fts_docs WHERE path = ?1", rusqlite::params![rel_path]) {
        eprintln!("[fts] warning: failed to delete '{rel_path}' from FTS index: {e}");
    }
    if let Err(e) = conn.execute(
        "INSERT INTO fts_docs(path, content) VALUES (?1, ?2)",
        rusqlite::params![rel_path, content],
    ) {
        eprintln!("[fts] warning: failed to insert '{rel_path}' into FTS index: {e}");
    }
}

/// Remove a file from the FTS index.
pub fn remove_file(conn: &Connection, rel_path: &str) {
    if let Err(e) = conn.execute("DELETE FROM fts_docs WHERE path = ?1", rusqlite::params![rel_path]) {
        eprintln!("[fts] warning: failed to delete '{rel_path}' from FTS index: {e}");
    }
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

#[cfg(test)]
mod tests {
    use super::*;

    fn make_db() -> Connection {
        create_fts_db().expect("failed to create in-memory FTS DB")
    }

    #[test]
    fn test_create_fts_db() {
        let conn = make_db();
        // Verify the virtual table exists by querying it
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM fts_docs", [], |r| r.get(0))
            .expect("fts_docs table should exist");
        assert_eq!(count, 0);
    }

    #[test]
    fn test_rebuild_fts_from_entries() {
        let conn = make_db();
        let entries = vec![
            ("notes/a.md".to_string(), "hello world".to_string()),
            ("notes/b.md".to_string(), "goodbye world".to_string()),
        ];
        rebuild_fts_from_entries(&conn, &entries).unwrap();

        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM fts_docs", [], |r| r.get(0))
            .unwrap();
        assert_eq!(count, 2);
    }

    #[test]
    fn test_rebuild_clears_previous_entries() {
        let conn = make_db();
        let entries1 = vec![("old.md".to_string(), "old content".to_string())];
        rebuild_fts_from_entries(&conn, &entries1).unwrap();

        let entries2 = vec![("new.md".to_string(), "new content".to_string())];
        rebuild_fts_from_entries(&conn, &entries2).unwrap();

        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM fts_docs", [], |r| r.get(0))
            .unwrap();
        assert_eq!(count, 1);
    }

    #[test]
    fn test_search_fts_finds_match() {
        let conn = make_db();
        let entries = vec![
            ("notes/a.md".to_string(), "the quick brown fox".to_string()),
            ("notes/b.md".to_string(), "lazy dog".to_string()),
        ];
        rebuild_fts_from_entries(&conn, &entries).unwrap();

        let results = search_fts(&conn, "quick").unwrap();
        assert_eq!(results.len(), 1);
        assert_eq!(results[0], "notes/a.md");
    }

    #[test]
    fn test_search_fts_no_match() {
        let conn = make_db();
        let entries = vec![("notes/a.md".to_string(), "hello world".to_string())];
        rebuild_fts_from_entries(&conn, &entries).unwrap();

        let results = search_fts(&conn, "notpresent").unwrap();
        assert!(results.is_empty());
    }

    #[test]
    fn test_search_fts_multiple_matches() {
        let conn = make_db();
        let entries = vec![
            ("a.md".to_string(), "rust programming language".to_string()),
            ("b.md".to_string(), "rust is great".to_string()),
            ("c.md".to_string(), "python is also great".to_string()),
        ];
        rebuild_fts_from_entries(&conn, &entries).unwrap();

        let mut results = search_fts(&conn, "rust").unwrap();
        results.sort();
        assert_eq!(results.len(), 2);
        assert!(results.contains(&"a.md".to_string()));
        assert!(results.contains(&"b.md".to_string()));
    }

    #[test]
    fn test_update_file_replaces_content() {
        let conn = make_db();
        let entries = vec![("note.md".to_string(), "original content".to_string())];
        rebuild_fts_from_entries(&conn, &entries).unwrap();

        update_file(&conn, "note.md", "completely different text");

        let results = search_fts(&conn, "original").unwrap();
        assert!(results.is_empty(), "old content should be gone");

        let results = search_fts(&conn, "different").unwrap();
        assert_eq!(results.len(), 1);
        assert_eq!(results[0], "note.md");
    }

    #[test]
    fn test_remove_file() {
        let conn = make_db();
        let entries = vec![
            ("keep.md".to_string(), "keep this".to_string()),
            ("remove.md".to_string(), "remove this".to_string()),
        ];
        rebuild_fts_from_entries(&conn, &entries).unwrap();

        remove_file(&conn, "remove.md");

        let results = search_fts(&conn, "remove").unwrap();
        assert!(results.is_empty());

        let results = search_fts(&conn, "keep").unwrap();
        assert_eq!(results.len(), 1);
    }

    #[test]
    fn test_search_fts_empty_db() {
        let conn = make_db();
        let results = search_fts(&conn, "anything").unwrap();
        assert!(results.is_empty());
    }

    #[test]
    fn test_rebuild_with_empty_entries() {
        let conn = make_db();
        let entries: Vec<(String, String)> = vec![];
        rebuild_fts_from_entries(&conn, &entries).unwrap();

        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM fts_docs", [], |r| r.get(0))
            .unwrap();
        assert_eq!(count, 0);
    }
}
