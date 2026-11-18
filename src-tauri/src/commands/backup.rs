use crate::db::DbState;
use crate::db::models::{Collection, Note, SettingItem};
use rusqlite::params;
use serde::{Deserialize, Serialize};
use std::fs;
use tauri::State;

#[derive(Serialize, Deserialize)]
pub struct FullBackupData {
    pub version: u32,
    pub exported_at: i64,
    pub collections: Vec<Collection>,
    pub notes: Vec<Note>,
    pub settings: Vec<SettingItem>,
}

#[tauri::command]
pub fn get_database_path(state: State<'_, DbState>) -> String {
    state.db_path.to_string_lossy().to_string()
}

#[tauri::command]
pub fn export_backup_json(state: State<'_, DbState>, file_path: String) -> Result<(), String> {
    let backup = {
        let conn = state.conn.lock().map_err(|e| e.to_string())?;

        // Fetch all collections (including soft-deleted for full fidelity)
        let mut c_stmt = conn
            .prepare("SELECT id, name, collection_type, parent_id, sort_order, created_at, updated_at, deleted_at FROM collections")
            .map_err(|e| e.to_string())?;
        let collections: Vec<Collection> = c_stmt
            .query_map([], |row| {
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
            })
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect();

        // Fetch all notes
        let mut n_stmt = conn
            .prepare("SELECT id, collection_id, title, content, is_pinned, sort_order, created_at, updated_at, deleted_at FROM notes")
            .map_err(|e| e.to_string())?;
        let notes: Vec<Note> = n_stmt
            .query_map([], |row| {
                Ok(Note {
                    id: row.get(0)?,
                    collection_id: row.get(1)?,
                    title: row.get(2)?,
                    content: row.get(3)?,
                    is_pinned: row.get::<_, i64>(4)? == 1,
                    sort_order: row.get(5)?,
                    created_at: row.get(6)?,
                    updated_at: row.get(7)?,
                    deleted_at: row.get(8)?,
                })
            })
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect();

        // Fetch settings
        let mut s_stmt = conn
            .prepare("SELECT key, value FROM settings")
            .map_err(|e| e.to_string())?;
        let settings: Vec<SettingItem> = s_stmt
            .query_map([], |row| {
                Ok(SettingItem {
                    key: row.get(0)?,
                    value: row.get(1)?,
                })
            })
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect();

        FullBackupData {
            version: 1,
            exported_at: chrono::Utc::now().timestamp_millis(),
            collections,
            notes,
            settings,
        }
    }; // Database lock explicitly dropped before disk serialization and I/O!

    let json_bytes = serde_json::to_vec_pretty(&backup).map_err(|e| e.to_string())?;
    fs::write(&file_path, json_bytes).map_err(|e| format!("Falha ao salvar backup: {}", e))?;

    Ok(())
}

#[tauri::command]
pub fn import_backup_json(state: State<'_, DbState>, file_path: String) -> Result<String, String> {
    let content = fs::read_to_string(&file_path)
        .map_err(|e| format!("Falha ao ler arquivo de backup: {}", e))?;

    let backup: FullBackupData =
        serde_json::from_str(&content).map_err(|e| format!("Formato de backup inválido: {}", e))?;

    let mut conn = state.conn.lock().map_err(|e| e.to_string())?;
    let tx = conn.transaction().map_err(|e| e.to_string())?;

    // Clear existing or upsert? Clean restore restores all tables
    tx.execute("DELETE FROM notes", [])
        .map_err(|e| e.to_string())?;
    tx.execute("DELETE FROM collections", [])
        .map_err(|e| e.to_string())?;

    // Sort collections parent-first so hierarchical foreign keys insert without constraint errors
    let mut inserted_ids: std::collections::HashSet<String> = std::collections::HashSet::new();
    let mut remaining: Vec<&Collection> = backup.collections.iter().collect();

    while !remaining.is_empty() {
        let mut next_remaining = Vec::new();
        let mut progress = false;

        for c in remaining {
            let parent_ready = match &c.parent_id {
                None => true,
                Some(pid) => inserted_ids.contains(pid),
            };
            if parent_ready {
                tx.execute(
                    "INSERT INTO collections (id, name, collection_type, parent_id, sort_order, created_at, updated_at, deleted_at)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                    params![
                        c.id,
                        c.name,
                        c.collection_type,
                        c.parent_id,
                        c.sort_order,
                        c.created_at,
                        c.updated_at,
                        c.deleted_at
                    ],
                ).map_err(|e| e.to_string())?;
                inserted_ids.insert(c.id.clone());
                progress = true;
            } else {
                next_remaining.push(c);
            }
        }

        if !progress {
            // Fallback: insert any orphaned collections without an existing parent as root
            for c in next_remaining {
                tx.execute(
                    "INSERT INTO collections (id, name, collection_type, parent_id, sort_order, created_at, updated_at, deleted_at)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                    params![
                        c.id,
                        c.name,
                        c.collection_type,
                        Option::<String>::None,
                        c.sort_order,
                        c.created_at,
                        c.updated_at,
                        c.deleted_at
                    ],
                ).map_err(|e| e.to_string())?;
                inserted_ids.insert(c.id.clone());
            }
            break;
        }
        remaining = next_remaining;
    }

    for n in &backup.notes {
        tx.execute(
            "INSERT INTO notes (id, collection_id, title, content, is_pinned, sort_order, created_at, updated_at, deleted_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![
                n.id,
                n.collection_id,
                n.title,
                n.content,
                if n.is_pinned { 1 } else { 0 },
                n.sort_order,
                n.created_at,
                n.updated_at,
                n.deleted_at
            ],
        ).map_err(|e| e.to_string())?;
    }

    for s in &backup.settings {
        tx.execute(
            "INSERT OR REPLACE INTO settings (key, value) VALUES (?1, ?2)",
            params![s.key, s.value],
        )
        .map_err(|e| e.to_string())?;
    }

    tx.commit().map_err(|e| e.to_string())?;

    Ok(format!(
        "Backup restaurado com sucesso! ({} coleções, {} notas restauradas)",
        backup.collections.len(),
        backup.notes.len()
    ))
}

#[tauri::command]
pub fn trigger_auto_backup(
    state: State<'_, DbState>,
    force: Option<bool>,
) -> Result<Option<crate::db::models::AutoBackupInfo>, String> {
    let backup_dir = match state.db_path.parent() {
        Some(p) => p.join("backups"),
        None => std::env::current_dir().unwrap_or_default().join("backups"),
    };
    let _ = fs::create_dir_all(&backup_dir);

    let today = chrono::Utc::now().format("%Y-%m-%d").to_string();
    let filename = format!("nook_auto_backup_{}.json", today);
    let target_path = backup_dir.join(&filename);

    if target_path.exists() && !force.unwrap_or(false) {
        return Ok(None);
    }

    export_backup_json(state.clone(), target_path.to_string_lossy().to_string())?;

    // Prune backups older than 7 days
    if let Ok(entries) = fs::read_dir(&backup_dir) {
        let mut backup_files = Vec::new();
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file()
                && let Some(name) = path.file_name().and_then(|n| n.to_str())
                && (name.starts_with("nook_auto_backup_")
                    || name.starts_with("lumina_auto_backup_"))
                && name.ends_with(".json")
            {
                let meta = entry.metadata().ok();
                let modified = meta
                    .and_then(|m| m.modified().ok())
                    .unwrap_or(std::time::SystemTime::UNIX_EPOCH);
                backup_files.push((path, modified));
            }
        }

        // Sort descending by modified date
        backup_files.sort_by_key(|a| std::cmp::Reverse(a.1));

        // Keep at most 7 most recent backups
        if backup_files.len() > 7 {
            for (old_path, _) in &backup_files[7..] {
                let _ = fs::remove_file(old_path);
            }
        }
    }

    let meta = fs::metadata(&target_path).map_err(|e| e.to_string())?;
    Ok(Some(crate::db::models::AutoBackupInfo {
        filename,
        path: target_path.to_string_lossy().to_string(),
        size_bytes: meta.len(),
        created_at: chrono::Utc::now().timestamp_millis(),
    }))
}

#[tauri::command]
pub fn list_auto_backups(
    state: State<'_, DbState>,
) -> Result<Vec<crate::db::models::AutoBackupInfo>, String> {
    let backup_dir = match state.db_path.parent() {
        Some(p) => p.join("backups"),
        None => std::env::current_dir().unwrap_or_default().join("backups"),
    };

    let mut list = Vec::new();
    if let Ok(entries) = fs::read_dir(&backup_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file()
                && let Some(name) = path.file_name().and_then(|n| n.to_str())
                && (name.starts_with("nook_") || name.starts_with("lumina_"))
                && name.ends_with(".json")
                && let Ok(meta) = entry.metadata()
            {
                let created_at = meta
                    .modified()
                    .ok()
                    .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                    .map(|d| d.as_millis() as i64)
                    .unwrap_or(0);
                list.push(crate::db::models::AutoBackupInfo {
                    filename: name.to_string(),
                    path: path.to_string_lossy().to_string(),
                    size_bytes: meta.len(),
                    created_at,
                });
            }
        }
    }

    list.sort_by_key(|a| std::cmp::Reverse(a.created_at));
    Ok(list)
}
