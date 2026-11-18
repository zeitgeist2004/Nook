use rusqlite::{params, Connection, Result};
use std::path::Path;
use std::time::Duration;

pub const CURRENT_SCHEMA_VERSION: i64 = 2;

pub fn get_schema_version(conn: &Connection) -> i64 {
    conn.query_row(
        "SELECT COALESCE(MAX(version), 0) FROM migrations",
        [],
        |row| row.get::<_, i64>(0),
    )
    .unwrap_or(0)
}

/// Executes a consistent online SQLite hot backup (including uncommitted WAL pages cleanly)
/// and validates integrity of the generated snapshot file.
pub fn backup_sqlite_to_file(src_conn: &Connection, dest_path: &Path) -> std::result::Result<(), String> {
    if let Some(parent) = dest_path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| format!("Failed to create backup dir: {}", e))?;
    }

    let tmp_path = dest_path.with_extension("db.tmp");
    if tmp_path.exists() {
        let _ = std::fs::remove_file(&tmp_path);
    }

    {
        let mut dst_conn = Connection::open(&tmp_path)
            .map_err(|e| format!("Failed to open temporary SQLite backup target: {}", e))?;
        {
            let backup = rusqlite::backup::Backup::new(src_conn, &mut dst_conn)
                .map_err(|e| format!("Failed to initialize SQLite backup: {}", e))?;
            backup
                .run_to_completion(100, Duration::from_millis(5), None)
                .map_err(|e| format!("SQLite online backup failed: {}", e))?;
        }
        let integrity: String = dst_conn
            .query_row("PRAGMA quick_check(1)", [], |row| row.get(0))
            .map_err(|e| format!("Backup verification failed: {}", e))?;
        if integrity != "ok" {
            return Err(format!("Backup SQLite integrity check failed: {}", integrity));
        }
    }

    if dest_path.exists() {
        let _ = std::fs::remove_file(dest_path);
    }
    std::fs::rename(&tmp_path, dest_path)
        .map_err(|e| format!("Failed to finalize SQLite backup file: {}", e))?;

    Ok(())
}

pub fn init_db(conn: &Connection) -> Result<()> {
    // Enable PRAGMAs for performance, integrity and WAL durability
    conn.execute_batch(
        "
        PRAGMA foreign_keys = ON;
        PRAGMA journal_mode = WAL;
        PRAGMA synchronous = NORMAL;
        PRAGMA busy_timeout = 5000;
        ",
    )?;

    // Create schema versioning table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS migrations (
            version INTEGER PRIMARY KEY,
            applied_at INTEGER NOT NULL
        )",
        [],
    )?;

    let current_version = get_schema_version(conn);
    let now_ms = chrono::Utc::now().timestamp_millis();

    // Migration v1: Baseline tables, indexes, and FTS5 triggers (idempotent)
    if current_version < 1 {
        let tx = conn.unchecked_transaction()?;

        tx.execute(
            "CREATE TABLE IF NOT EXISTS collections (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                collection_type TEXT NOT NULL CHECK(collection_type IN ('project', 'folder')),
                parent_id TEXT REFERENCES collections(id) ON DELETE SET NULL,
                sort_order INTEGER NOT NULL DEFAULT 0,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL,
                deleted_at INTEGER
            )",
            [],
        )?;

        tx.execute(
            "CREATE TABLE IF NOT EXISTS notes (
                id TEXT PRIMARY KEY,
                collection_id TEXT REFERENCES collections(id) ON DELETE SET NULL,
                title TEXT NOT NULL DEFAULT 'Sem título',
                content TEXT NOT NULL DEFAULT '',
                is_pinned INTEGER NOT NULL DEFAULT 0,
                sort_order INTEGER NOT NULL DEFAULT 0,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL,
                deleted_at INTEGER
            )",
            [],
        )?;

        tx.execute(
            "CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            )",
            [],
        )?;

        tx.execute(
            "CREATE TABLE IF NOT EXISTS note_versions (
                id TEXT PRIMARY KEY,
                note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
                title TEXT NOT NULL,
                content TEXT NOT NULL,
                created_at INTEGER NOT NULL
            )",
            [],
        )?;

        tx.execute(
            "CREATE TABLE IF NOT EXISTS authorized_devices (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                user_agent TEXT NOT NULL,
                token_hash TEXT NOT NULL UNIQUE,
                ip_hint TEXT,
                created_at INTEGER NOT NULL,
                last_active_at INTEGER NOT NULL,
                is_revoked INTEGER NOT NULL DEFAULT 0
            )",
            [],
        )?;

        tx.execute_batch(
            "
            CREATE INDEX IF NOT EXISTS idx_notes_collection_id ON notes(collection_id);
            CREATE INDEX IF NOT EXISTS idx_notes_deleted_at ON notes(deleted_at);
            CREATE INDEX IF NOT EXISTS idx_notes_updated_at ON notes(updated_at DESC);
            CREATE INDEX IF NOT EXISTS idx_notes_is_pinned ON notes(is_pinned DESC);
            CREATE INDEX IF NOT EXISTS idx_notes_active_lookup ON notes(deleted_at, is_pinned DESC, updated_at DESC);
            CREATE INDEX IF NOT EXISTS idx_notes_collection_active ON notes(collection_id, deleted_at);
            CREATE INDEX IF NOT EXISTS idx_collections_parent_id ON collections(parent_id);
            CREATE INDEX IF NOT EXISTS idx_collections_deleted_at ON collections(deleted_at);
            CREATE INDEX IF NOT EXISTS idx_collections_type ON collections(collection_type);
            CREATE INDEX IF NOT EXISTS idx_note_versions_note_id ON note_versions(note_id, created_at DESC);
            CREATE INDEX IF NOT EXISTS idx_authorized_devices_token_hash ON authorized_devices(token_hash);
            CREATE INDEX IF NOT EXISTS idx_authorized_devices_revoked ON authorized_devices(is_revoked);
            ",
        )?;

        tx.execute(
            "INSERT OR IGNORE INTO migrations (version, applied_at) VALUES (1, ?1)",
            params![now_ms],
        )?;
        tx.commit()?;
    }

    // Migration v2: Smart backup policy defaults (non-destructive, never overwrites existing values)
    if current_version < 2 {
        let tx = conn.unchecked_transaction()?;
        tx.execute(
            "INSERT OR IGNORE INTO settings (key, value) VALUES ('backup_enabled', 'true')",
            [],
        )?;
        tx.execute(
            "INSERT OR IGNORE INTO settings (key, value) VALUES ('backup_frequency', 'daily')",
            [],
        )?;
        tx.execute(
            "INSERT OR IGNORE INTO settings (key, value) VALUES ('backup_retention_days', '7')",
            [],
        )?;
        tx.execute(
            "INSERT OR IGNORE INTO settings (key, value) VALUES ('auto_update_check', 'true')",
            [],
        )?;
        tx.execute(
            "INSERT OR IGNORE INTO migrations (version, applied_at) VALUES (2, ?1)",
            params![now_ms],
        )?;
        tx.commit()?;
    }

    // Try creating FTS5 table with fallback
    let _ = conn.execute_batch(
        "
        CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
            note_id UNINDEXED,
            title,
            content,
            tokenize = 'unicode61 remove_diacritics 2'
        );

        CREATE TRIGGER IF NOT EXISTS trg_notes_insert AFTER INSERT ON notes BEGIN
            INSERT INTO notes_fts(note_id, title, content)
            VALUES (new.id, new.title, new.content);
        END;

        CREATE TRIGGER IF NOT EXISTS trg_notes_update AFTER UPDATE OF title, content ON notes BEGIN
            UPDATE notes_fts
            SET title = new.title, content = new.content
            WHERE note_id = new.id;
        END;

        CREATE TRIGGER IF NOT EXISTS trg_notes_delete AFTER DELETE ON notes BEGIN
            DELETE FROM notes_fts WHERE note_id = old.id;
        END;
        ",
    );

    Ok(())
}
