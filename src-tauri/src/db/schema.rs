use rusqlite::{Connection, Result};

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

    // Create collections table
    conn.execute(
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

    // Create notes table
    conn.execute(
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

    // Create settings table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )",
        [],
    )?;

    // Create note_versions table for discrete version history
    conn.execute(
        "CREATE TABLE IF NOT EXISTS note_versions (
            id TEXT PRIMARY KEY,
            note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at INTEGER NOT NULL
        )",
        [],
    )?;

    // Create authorized_devices table for Nook Mobile paired devices
    conn.execute(
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

    // Indexes for fast lookups, sorting and composite filtering
    conn.execute_batch(
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
