use super::models::{AuthorizedDevice, Collection, Note, NoteSummary, NoteVersion, SearchResultItem, SettingItem};
use chrono::Utc;
use rusqlite::{Connection, Result, params};
use std::collections::HashSet;
use uuid::Uuid;

pub struct DbQueries;

impl DbQueries {
    // -------------------------------------------------------------
    // NOTES OPERATIONS
    // -------------------------------------------------------------

    pub fn list_active_notes(conn: &Connection) -> Result<Vec<NoteSummary>> {
        let mut stmt = conn.prepare(
            "SELECT id, collection_id, title, SUBSTR(content, 1, 150), is_pinned, sort_order, created_at, updated_at, deleted_at
             FROM notes
             WHERE deleted_at IS NULL
             ORDER BY is_pinned DESC, updated_at DESC",
        )?;

        let rows = stmt.query_map([], |row| {
            let snippet_raw: String = row.get(3)?;
            let snippet = if snippet_raw.chars().count() > 120 {
                let end = snippet_raw
                    .char_indices()
                    .map(|(i, _)| i)
                    .nth(120)
                    .unwrap_or(snippet_raw.len());
                format!("{}...", &snippet_raw[..end])
            } else {
                snippet_raw
            };

            Ok(NoteSummary {
                id: row.get(0)?,
                collection_id: row.get(1)?,
                title: row.get(2)?,
                snippet,
                is_pinned: row.get::<_, i64>(4)? == 1,
                sort_order: row.get(5)?,
                created_at: row.get(6)?,
                updated_at: row.get(7)?,
                deleted_at: row.get(8)?,
            })
        })?;

        let mut list = Vec::new();
        for r in rows {
            list.push(r?);
        }
        Ok(list)
    }

    pub fn get_note_by_id(conn: &Connection, id: &str) -> Result<Option<Note>> {
        let mut stmt = conn.prepare(
            "SELECT id, collection_id, title, content, is_pinned, sort_order, created_at, updated_at, deleted_at
             FROM notes WHERE id = ?1",
        )?;

        let mut rows = stmt.query(params![id])?;
        if let Some(row) = rows.next()? {
            Ok(Some(Note {
                id: row.get(0)?,
                collection_id: row.get(1)?,
                title: row.get(2)?,
                content: row.get(3)?,
                is_pinned: row.get::<_, i64>(4)? == 1,
                sort_order: row.get(5)?,
                created_at: row.get(6)?,
                updated_at: row.get(7)?,
                deleted_at: row.get(8)?,
            }))
        } else {
            Ok(None)
        }
    }

    pub fn create_note(
        conn: &Connection,
        collection_id: Option<String>,
        title: Option<String>,
        content: Option<String>,
    ) -> Result<Note> {
        let id = Uuid::new_v4().to_string();
        let now = Utc::now().timestamp_millis();
        let note_title = title.unwrap_or_else(|| "Sem título".to_string());
        let note_content = content.unwrap_or_default();

        conn.execute(
            "INSERT INTO notes (id, collection_id, title, content, is_pinned, sort_order, created_at, updated_at, deleted_at)
             VALUES (?1, ?2, ?3, ?4, 0, 0, ?5, ?5, NULL)",
            params![id, collection_id, note_title, note_content, now],
        )?;

        Ok(Note {
            id,
            collection_id,
            title: note_title,
            content: note_content,
            is_pinned: false,
            sort_order: 0,
            created_at: now,
            updated_at: now,
            deleted_at: None,
        })
    }

    pub fn save_note_content(
        conn: &Connection,
        id: &str,
        title: &str,
        content: &str,
    ) -> Result<i64> {
        let now = Utc::now().timestamp_millis();

        // Automatic periodic version snapshot (every ~5 minutes of modifications)
        let existing: Option<(String, String)> = conn
            .query_row(
                "SELECT title, content FROM notes WHERE id = ?1",
                params![id],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .ok();

        if let Some((existing_title, existing_content)) = existing
            && (existing_content != content || existing_title != title)
        {
            let last_version_time: Option<i64> = conn
                .query_row(
                    "SELECT created_at FROM note_versions WHERE note_id = ?1 ORDER BY created_at DESC LIMIT 1",
                    params![id],
                    |row| row.get(0),
                )
                .ok();

            let should_snapshot = match last_version_time {
                Some(t) => now - t >= 300_000, // 5 minutes
                None => true,                  // first modification after note creation
            };

            if should_snapshot
                && (!existing_content.trim().is_empty() || !existing_title.trim().is_empty())
            {
                let _ = Self::create_note_version(conn, id, &existing_title, &existing_content);
            }
        }

        let rows_affected = conn.execute(
            "UPDATE notes SET title = ?1, content = ?2, updated_at = ?3 WHERE id = ?4",
            params![title, content, now, id],
        )?;

        if rows_affected == 0 {
            // Note does not exist, insert it
            conn.execute(
                "INSERT INTO notes (id, collection_id, title, content, is_pinned, sort_order, created_at, updated_at, deleted_at)
                 VALUES (?1, NULL, ?2, ?3, 0, 0, ?4, ?4, NULL)",
                params![id, title, content, now],
            )?;
        }
        Ok(now)
    }

    pub fn create_note_version(
        conn: &Connection,
        note_id: &str,
        title: &str,
        content: &str,
    ) -> Result<NoteVersion> {
        // Skip duplicate version if content and title match the latest version
        let latest: Option<(String, String)> = conn
            .query_row(
                "SELECT title, content FROM note_versions WHERE note_id = ?1 ORDER BY created_at DESC LIMIT 1",
                params![note_id],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .ok();

        if let Some((last_title, last_content)) = latest
            && last_title == title
            && last_content == content
        {
            let id: String = conn.query_row(
                "SELECT id FROM note_versions WHERE note_id = ?1 ORDER BY created_at DESC LIMIT 1",
                params![note_id],
                |row| row.get(0),
            )?;
            let created_at: i64 = conn.query_row(
                "SELECT created_at FROM note_versions WHERE id = ?1",
                params![id],
                |row| row.get(0),
            )?;
            return Ok(NoteVersion {
                id,
                note_id: note_id.to_string(),
                title: title.to_string(),
                content: content.to_string(),
                created_at,
            });
        }

        let id = Uuid::new_v4().to_string();
        let now = Utc::now().timestamp_millis();

        conn.execute(
            "INSERT INTO note_versions (id, note_id, title, content, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![id, note_id, title, content, now],
        )?;

        // Pruning: keep at most 30 versions per note; prune older than 7 days if total > 5
        let seven_days_ago = now - (7 * 24 * 60 * 60 * 1000);
        let _ = conn.execute(
            "DELETE FROM note_versions WHERE note_id = ?1 AND created_at < ?2
             AND id NOT IN (SELECT id FROM note_versions WHERE note_id = ?1 ORDER BY created_at DESC LIMIT 5)",
            params![note_id, seven_days_ago],
        );
        let _ = conn.execute(
            "DELETE FROM note_versions WHERE note_id = ?1 AND id NOT IN (
                SELECT id FROM note_versions WHERE note_id = ?1 ORDER BY created_at DESC LIMIT 30
            )",
            params![note_id],
        );

        Ok(NoteVersion {
            id,
            note_id: note_id.to_string(),
            title: title.to_string(),
            content: content.to_string(),
            created_at: now,
        })
    }

    pub fn list_note_versions(conn: &Connection, note_id: &str) -> Result<Vec<NoteVersion>> {
        let mut stmt = conn.prepare(
            "SELECT id, note_id, title, content, created_at
             FROM note_versions
             WHERE note_id = ?1
             ORDER BY created_at DESC LIMIT 50",
        )?;

        let rows = stmt.query_map(params![note_id], |row| {
            Ok(NoteVersion {
                id: row.get(0)?,
                note_id: row.get(1)?,
                title: row.get(2)?,
                content: row.get(3)?,
                created_at: row.get(4)?,
            })
        })?;

        let mut list = Vec::new();
        for r in rows {
            list.push(r?);
        }
        Ok(list)
    }

    pub fn restore_note_version(
        conn: &Connection,
        note_id: &str,
        version_id: &str,
    ) -> Result<Option<Note>> {
        let target_ver: Option<(String, String)> = conn
            .query_row(
                "SELECT title, content FROM note_versions WHERE id = ?1 AND note_id = ?2",
                params![version_id, note_id],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .ok();

        let (target_title, target_content) = match target_ver {
            Some(v) => v,
            None => return Ok(None),
        };

        // Snapshot current note state first so restoration is 100% reversible!
        if let Ok(Some(current)) = Self::get_note_by_id(conn, note_id) {
            let _ = Self::create_note_version(conn, note_id, &current.title, &current.content);
        }

        // Apply restoration
        let now = Utc::now().timestamp_millis();
        conn.execute(
            "UPDATE notes SET title = ?1, content = ?2, updated_at = ?3 WHERE id = ?4",
            params![target_title, target_content, now, note_id],
        )?;

        Self::get_note_by_id(conn, note_id)
    }

    pub fn update_note_title(conn: &Connection, id: &str, title: &str) -> Result<()> {
        let now = Utc::now().timestamp_millis();
        conn.execute(
            "UPDATE notes SET title = ?1, updated_at = ?2 WHERE id = ?3",
            params![title, now, id],
        )?;
        Ok(())
    }

    pub fn duplicate_note(conn: &Connection, id: &str) -> Result<Option<Note>> {
        let original = match Self::get_note_by_id(conn, id)? {
            Some(n) => n,
            None => return Ok(None),
        };

        let new_id = Uuid::new_v4().to_string();
        let now = Utc::now().timestamp_millis();
        let new_title = format!("{} (cópia)", original.title);

        conn.execute(
            "INSERT INTO notes (id, collection_id, title, content, is_pinned, sort_order, created_at, updated_at, deleted_at)
             VALUES (?1, ?2, ?3, ?4, 0, ?5, ?6, ?6, NULL)",
            params![new_id, original.collection_id, new_title, original.content, original.sort_order + 1, now],
        )?;

        Ok(Some(Note {
            id: new_id,
            collection_id: original.collection_id,
            title: new_title,
            content: original.content,
            is_pinned: false,
            sort_order: original.sort_order + 1,
            created_at: now,
            updated_at: now,
            deleted_at: None,
        }))
    }

    pub fn move_note(
        conn: &Connection,
        id: &str,
        target_collection_id: Option<String>,
    ) -> Result<()> {
        let now = Utc::now().timestamp_millis();
        conn.execute(
            "UPDATE notes SET collection_id = ?1, updated_at = ?2 WHERE id = ?3",
            params![target_collection_id, now, id],
        )?;
        Ok(())
    }

    pub fn toggle_pin_note(conn: &Connection, id: &str) -> Result<bool> {
        let now = Utc::now().timestamp_millis();
        let mut stmt = conn.prepare("SELECT is_pinned FROM notes WHERE id = ?1")?;
        let is_pinned: i64 = stmt.query_row(params![id], |r| r.get(0))?;
        let new_pinned = if is_pinned == 1 { 0 } else { 1 };

        conn.execute(
            "UPDATE notes SET is_pinned = ?1, updated_at = ?2 WHERE id = ?3",
            params![new_pinned, now, id],
        )?;

        Ok(new_pinned == 1)
    }

    pub fn soft_delete_note(conn: &Connection, id: &str) -> Result<()> {
        let now = Utc::now().timestamp_millis();
        conn.execute(
            "UPDATE notes SET deleted_at = ?1 WHERE id = ?2",
            params![now, id],
        )?;
        Ok(())
    }

    pub fn restore_note(conn: &Connection, id: &str) -> Result<()> {
        let now = Utc::now().timestamp_millis();
        // Check if parent collection still exists and is not deleted
        let mut stmt = conn.prepare("SELECT collection_id FROM notes WHERE id = ?1")?;
        let collection_id: Option<String> = stmt.query_row(params![id], |r| r.get(0))?;

        let mut valid_collection = collection_id.clone();
        if let Some(cid) = &collection_id {
            let mut check_stmt =
                conn.prepare("SELECT id FROM collections WHERE id = ?1 AND deleted_at IS NULL")?;
            let exists = check_stmt.exists(params![cid])?;
            if !exists {
                // Folder was deleted or non-existent, restore to Quick Notes
                valid_collection = None;
            }
        }

        conn.execute(
            "UPDATE notes SET deleted_at = NULL, collection_id = ?1, updated_at = ?2 WHERE id = ?3",
            params![valid_collection, now, id],
        )?;
        Ok(())
    }

    pub fn permanent_delete_note(conn: &Connection, id: &str) -> Result<()> {
        conn.execute("DELETE FROM notes WHERE id = ?1", params![id])?;
        Ok(())
    }

    pub fn list_trash_notes(conn: &Connection) -> Result<Vec<NoteSummary>> {
        let mut stmt = conn.prepare(
            "SELECT id, collection_id, title, SUBSTR(content, 1, 100), is_pinned, sort_order, created_at, updated_at, deleted_at
             FROM notes
             WHERE deleted_at IS NOT NULL
             ORDER BY deleted_at DESC",
        )?;

        let rows = stmt.query_map([], |row| {
            let snippet_raw: String = row.get(3)?;
            let snippet = if snippet_raw.chars().count() > 80 {
                let end = snippet_raw
                    .char_indices()
                    .map(|(i, _)| i)
                    .nth(80)
                    .unwrap_or(snippet_raw.len());
                format!("{}...", &snippet_raw[..end])
            } else {
                snippet_raw
            };

            Ok(NoteSummary {
                id: row.get(0)?,
                collection_id: row.get(1)?,
                title: row.get(2)?,
                snippet,
                is_pinned: row.get::<_, i64>(4)? == 1,
                sort_order: row.get(5)?,
                created_at: row.get(6)?,
                updated_at: row.get(7)?,
                deleted_at: row.get(8)?,
            })
        })?;

        let mut list = Vec::new();
        for r in rows {
            list.push(r?);
        }
        Ok(list)
    }

    pub fn empty_trash(conn: &Connection) -> Result<()> {
        conn.execute("DELETE FROM notes WHERE deleted_at IS NOT NULL", [])?;
        conn.execute("DELETE FROM collections WHERE deleted_at IS NOT NULL", [])?;
        Ok(())
    }

    // -------------------------------------------------------------
    // COLLECTIONS OPERATIONS
    // -------------------------------------------------------------

    pub fn list_active_collections(conn: &Connection) -> Result<Vec<Collection>> {
        let mut stmt = conn.prepare(
            "SELECT id, name, collection_type, parent_id, sort_order, created_at, updated_at, deleted_at
             FROM collections
             WHERE deleted_at IS NULL
             ORDER BY sort_order ASC, name ASC",
        )?;

        let rows = stmt.query_map([], |row| {
            Ok(Collection {
                id: row.get(0)?,
                name: row.get(1)?,
                collection_type: row.get(2)?,
                parent_id: row.get(3)?,
                sort_order: row.get(4)?,
                created_at: row.get(5)?,
                updated_at: row.get(6)?,
                deleted_at: row.get(7)?,
            })
        })?;

        let mut list = Vec::new();
        for r in rows {
            list.push(r?);
        }
        Ok(list)
    }

    pub fn create_collection(
        conn: &Connection,
        name: &str,
        collection_type: &str, // 'project' | 'folder'
        parent_id: Option<String>,
    ) -> Result<Collection> {
        let id = Uuid::new_v4().to_string();
        let now = Utc::now().timestamp_millis();

        conn.execute(
            "INSERT INTO collections (id, name, collection_type, parent_id, sort_order, created_at, updated_at, deleted_at)
             VALUES (?1, ?2, ?3, ?4, 0, ?5, ?5, NULL)",
            params![id, name, collection_type, parent_id, now],
        )?;

        Ok(Collection {
            id,
            name: name.to_string(),
            collection_type: collection_type.to_string(),
            parent_id,
            sort_order: 0,
            created_at: now,
            updated_at: now,
            deleted_at: None,
        })
    }

    pub fn update_collection_name(conn: &Connection, id: &str, name: &str) -> Result<()> {
        let now = Utc::now().timestamp_millis();
        conn.execute(
            "UPDATE collections SET name = ?1, updated_at = ?2 WHERE id = ?3",
            params![name, now, id],
        )?;
        Ok(())
    }

    pub fn move_collection(
        conn: &Connection,
        id: &str,
        target_parent_id: Option<String>,
    ) -> std::result::Result<(), String> {
        if let Some(target) = &target_parent_id {
            if target == id {
                return Err("Não é possível mover uma pasta para dentro dela mesma.".to_string());
            }

            // Cycle prevention: verify target is not a descendant of id
            let mut visited = HashSet::new();
            let mut curr = Some(target.clone());

            while let Some(current_id) = curr {
                if current_id == id {
                    return Err(
                        "Não é possível mover uma pasta para dentro de uma de suas subpastas."
                            .to_string(),
                    );
                }
                if visited.contains(&current_id) {
                    break;
                }
                visited.insert(current_id.clone());

                let mut stmt = conn
                    .prepare("SELECT parent_id FROM collections WHERE id = ?1")
                    .map_err(|e| e.to_string())?;
                let parent: Option<String> = stmt
                    .query_row(params![current_id], |r| r.get(0))
                    .unwrap_or(None);
                curr = parent;
            }
        }

        let now = Utc::now().timestamp_millis();
        conn.execute(
            "UPDATE collections SET parent_id = ?1, updated_at = ?2 WHERE id = ?3",
            params![target_parent_id, now, id],
        )
        .map_err(|e| e.to_string())?;

        Ok(())
    }

    pub fn reorder_collections(conn: &Connection, ordered_ids: &[String]) -> Result<()> {
        let now = Utc::now().timestamp_millis();
        let mut stmt = conn.prepare("UPDATE collections SET sort_order = ?1, updated_at = ?2 WHERE id = ?3")?;
        for (index, id) in ordered_ids.iter().enumerate() {
            stmt.execute(params![index as i64, now, id])?;
        }
        Ok(())
    }

    pub fn soft_delete_collection(conn: &Connection, id: &str) -> Result<()> {
        let now = Utc::now().timestamp_millis();

        // Find all descendants recursively
        let mut to_delete = vec![id.to_string()];
        let mut idx = 0;
        while idx < to_delete.len() {
            let cur_id = &to_delete[idx];
            let mut stmt = conn.prepare(
                "SELECT id FROM collections WHERE parent_id = ?1 AND deleted_at IS NULL",
            )?;
            let rows = stmt.query_map(params![cur_id], |r| r.get::<_, String>(0))?;
            for r in rows {
                to_delete.push(r?);
            }
            idx += 1;
        }

        for cid in &to_delete {
            conn.execute(
                "UPDATE collections SET deleted_at = ?1 WHERE id = ?2",
                params![now, cid],
            )?;
            // Also soft-delete notes inside this collection
            conn.execute(
                "UPDATE notes SET deleted_at = ?1 WHERE collection_id = ?2 AND deleted_at IS NULL",
                params![now, cid],
            )?;
        }

        Ok(())
    }

    pub fn restore_collection(conn: &Connection, id: &str) -> Result<()> {
        let now = Utc::now().timestamp_millis();
        conn.execute(
            "UPDATE collections SET deleted_at = NULL, updated_at = ?1 WHERE id = ?2",
            params![now, id],
        )?;
        // Restore notes directly inside it as well
        conn.execute(
            "UPDATE notes SET deleted_at = NULL, updated_at = ?1 WHERE collection_id = ?2",
            params![now, id],
        )?;
        Ok(())
    }

    pub fn list_trash_collections(conn: &Connection) -> Result<Vec<Collection>> {
        let mut stmt = conn.prepare(
            "SELECT id, name, collection_type, parent_id, sort_order, created_at, updated_at, deleted_at
             FROM collections
             WHERE deleted_at IS NOT NULL
             ORDER BY deleted_at DESC",
        )?;

        let rows = stmt.query_map([], |row| {
            Ok(Collection {
                id: row.get(0)?,
                name: row.get(1)?,
                collection_type: row.get(2)?,
                parent_id: row.get(3)?,
                sort_order: row.get(4)?,
                created_at: row.get(5)?,
                updated_at: row.get(6)?,
                deleted_at: row.get(7)?,
            })
        })?;

        let mut list = Vec::new();
        for r in rows {
            list.push(r?);
        }
        Ok(list)
    }

    // -------------------------------------------------------------
    // SEARCH
    // -------------------------------------------------------------

    pub fn search(conn: &Connection, query: &str) -> Result<Vec<SearchResultItem>> {
        let clean_query = query.trim();
        if clean_query.is_empty() {
            return Ok(Vec::new());
        }

        let mut results = Vec::new();

        // 1. Search collections
        let coll_like = format!("%{}%", clean_query);
        let mut c_stmt = conn.prepare(
            "SELECT id, name, updated_at FROM collections
             WHERE deleted_at IS NULL AND name LIKE ?1
             ORDER BY updated_at DESC LIMIT 10",
        )?;
        let c_rows = c_stmt.query_map(params![coll_like], |row| {
            Ok(SearchResultItem {
                id: row.get(0)?,
                item_type: "collection".to_string(),
                title: row.get(1)?,
                snippet: None,
                collection_id: None,
                collection_name: None,
                updated_at: row.get(2)?,
            })
        })?;
        for r in c_rows {
            results.push(r?);
        }

        // 2. Search notes using FTS5 with fallback to LIKE
        let mut found_note_ids = HashSet::new();

        // Attempt FTS5 query
        let fts_query = format!("\"{}\"*", clean_query.replace('"', "\"\""));
        let fts_run = conn.prepare(
            "SELECT n.id, n.title, n.content, n.collection_id, c.name, n.updated_at
             FROM notes_fts f
             JOIN notes n ON n.id = f.note_id
             LEFT JOIN collections c ON c.id = n.collection_id
             WHERE n.deleted_at IS NULL AND notes_fts MATCH ?1
             ORDER BY n.updated_at DESC LIMIT 30",
        );

        if let Ok(mut stmt) = fts_run
            && let Ok(rows) = stmt.query_map(params![fts_query], |row| {
                let id: String = row.get(0)?;
                let title: String = row.get(1)?;
                let content: String = row.get(2)?;
                let collection_id: Option<String> = row.get(3)?;
                let collection_name: Option<String> = row.get(4)?;
                let updated_at: i64 = row.get(5)?;

                let snippet = extract_snippet(&content, clean_query);

                Ok(SearchResultItem {
                    id,
                    item_type: "note".to_string(),
                    title,
                    snippet: Some(snippet),
                    collection_id,
                    collection_name,
                    updated_at,
                })
            })
        {
            for r in rows.flatten() {
                found_note_ids.insert(r.id.clone());
                results.push(r);
            }
        }

        // Fallback or supplementary LIKE search for notes
        let note_like = format!("%{}%", clean_query);
        let mut n_stmt = conn.prepare(
            "SELECT n.id, n.title, n.content, n.collection_id, c.name, n.updated_at
             FROM notes n
             LEFT JOIN collections c ON c.id = n.collection_id
             WHERE n.deleted_at IS NULL AND (n.title LIKE ?1 OR n.content LIKE ?1)
             ORDER BY n.updated_at DESC LIMIT 30",
        )?;

        let n_rows = n_stmt.query_map(params![note_like], |row| {
            let id: String = row.get(0)?;
            let title: String = row.get(1)?;
            let content: String = row.get(2)?;
            let collection_id: Option<String> = row.get(3)?;
            let collection_name: Option<String> = row.get(4)?;
            let updated_at: i64 = row.get(5)?;

            let snippet = extract_snippet(&content, clean_query);

            Ok(SearchResultItem {
                id,
                item_type: "note".to_string(),
                title,
                snippet: Some(snippet),
                collection_id,
                collection_name,
                updated_at,
            })
        })?;

        for r in n_rows {
            let item = r?;
            if !found_note_ids.contains(&item.id) {
                found_note_ids.insert(item.id.clone());
                results.push(item);
            }
        }

        Ok(results)
    }

    // -------------------------------------------------------------
    // SETTINGS
    // -------------------------------------------------------------

    pub fn get_settings(conn: &Connection) -> Result<Vec<SettingItem>> {
        let mut stmt = conn.prepare("SELECT key, value FROM settings")?;
        let rows = stmt.query_map([], |row| {
            Ok(SettingItem {
                key: row.get(0)?,
                value: row.get(1)?,
            })
        })?;

        let mut list = Vec::new();
        for r in rows {
            list.push(r?);
        }
        Ok(list)
    }

    pub fn set_setting(conn: &Connection, key: &str, value: &str) -> Result<()> {
        conn.execute(
            "INSERT INTO settings (key, value) VALUES (?1, ?2)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            params![key, value],
        )?;
        Ok(())
    }

    // -------------------------------------------------------------
    // NOOK MOBILE AUTHORIZED DEVICES
    // -------------------------------------------------------------

    pub fn create_authorized_device(
        conn: &Connection,
        id: &str,
        name: &str,
        user_agent: &str,
        token_hash: &str,
        ip_hint: Option<&str>,
    ) -> Result<()> {
        let now = chrono::Utc::now().timestamp_millis();
        conn.execute(
            "INSERT INTO authorized_devices (id, name, user_agent, token_hash, ip_hint, created_at, last_active_at, is_revoked)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 0)",
            params![id, name, user_agent, token_hash, ip_hint, now, now],
        )?;
        Ok(())
    }

    pub fn get_authorized_devices(conn: &Connection) -> Result<Vec<AuthorizedDevice>> {
        let mut stmt = conn.prepare(
            "SELECT id, name, user_agent, token_hash, ip_hint, created_at, last_active_at, is_revoked
             FROM authorized_devices
             ORDER BY last_active_at DESC"
        )?;
        let rows = stmt.query_map([], |row| {
            let is_revoked_int: i64 = row.get(7)?;
            Ok(AuthorizedDevice {
                id: row.get(0)?,
                name: row.get(1)?,
                user_agent: row.get(2)?,
                token_hash: row.get(3)?,
                ip_hint: row.get(4)?,
                created_at: row.get(5)?,
                last_active_at: row.get(6)?,
                is_revoked: is_revoked_int != 0,
            })
        })?;

        let mut list = Vec::new();
        for r in rows {
            list.push(r?);
        }
        Ok(list)
    }

    pub fn validate_and_touch_device(conn: &Connection, token_hash: &str) -> Result<Option<AuthorizedDevice>> {
        let mut stmt = conn.prepare(
            "SELECT id, name, user_agent, token_hash, ip_hint, created_at, last_active_at, is_revoked
             FROM authorized_devices
             WHERE token_hash = ?1 AND is_revoked = 0"
        )?;
        let mut rows = stmt.query(params![token_hash])?;
        if let Some(row) = rows.next()? {
            let id: String = row.get(0)?;
            let now = chrono::Utc::now().timestamp_millis();
            let _ = conn.execute(
                "UPDATE authorized_devices SET last_active_at = ?1 WHERE id = ?2",
                params![now, id],
            );
            Ok(Some(AuthorizedDevice {
                id,
                name: row.get(1)?,
                user_agent: row.get(2)?,
                token_hash: row.get(3)?,
                ip_hint: row.get(4)?,
                created_at: row.get(5)?,
                last_active_at: now,
                is_revoked: false,
            }))
        } else {
            Ok(None)
        }
    }

    pub fn revoke_authorized_device(conn: &Connection, id: &str) -> Result<()> {
        conn.execute(
            "UPDATE authorized_devices SET is_revoked = 1 WHERE id = ?1",
            params![id],
        )?;
        Ok(())
    }

    pub fn delete_authorized_device(conn: &Connection, id: &str) -> Result<()> {
        conn.execute(
            "DELETE FROM authorized_devices WHERE id = ?1",
            params![id],
        )?;
        Ok(())
    }
}

fn extract_snippet(content: &str, query: &str) -> String {
    let lower_content = content.to_lowercase();
    let lower_query = query.to_lowercase();

    if let Some(byte_pos) = lower_content.find(&lower_query) {
        let mut start = byte_pos.saturating_sub(35);
        while start > 0 && !content.is_char_boundary(start) {
            start = start.saturating_sub(1);
        }

        let mut end = (byte_pos + query.len() + 65).min(content.len());
        while end < content.len() && !content.is_char_boundary(end) {
            end += 1;
        }

        let prefix = if start > 0 { "..." } else { "" };
        let suffix = if end < content.len() { "..." } else { "" };

        format!("{}{}{}", prefix, &content[start..end], suffix)
    } else if content.chars().count() > 100 {
        let end = content
            .char_indices()
            .map(|(i, _)| i)
            .nth(100)
            .unwrap_or(content.len());
        format!("{}...", &content[..end])
    } else {
        content.to_string()
    }
}
