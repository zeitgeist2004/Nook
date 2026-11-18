use crate::db::models::{
    AutoBackupInfo, AutoBackupSummary, CacheStats, ClearCacheResult, Collection,
    DeleteBackupsResult, Note, NoteVersion, SettingItem,
};
use crate::db::queries::DbQueries;
use crate::db::schema::backup_sqlite_to_file;
use crate::db::DbState;
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use tauri::State;

#[derive(Serialize, Deserialize)]
pub struct FullBackupData {
    pub version: u32,
    pub exported_at: i64,
    pub collections: Vec<Collection>,
    pub notes: Vec<Note>,
    pub settings: Vec<SettingItem>,
    #[serde(default)]
    pub note_versions: Vec<NoteVersion>,
}

const MS_PER_HOUR: i64 = 3_600_000;
const MS_PER_DAY: i64 = 86_400_000;

pub fn is_managed_auto_backup_filename(name: &str) -> bool {
    (name.starts_with("nook_auto_backup_") || name.starts_with("lumina_auto_backup_"))
        && name.ends_with(".json")
}

pub fn parse_frequency_interval_ms(freq: &str) -> i64 {
    match freq.trim().to_ascii_lowercase().as_str() {
        "12h" | "12_hours" => 12 * MS_PER_HOUR,
        "weekly" | "7d" => 7 * MS_PER_DAY,
        _ => MS_PER_DAY, // Recommended default: daily
    }
}

pub fn normalize_frequency(freq: &str) -> &'static str {
    match freq.trim().to_ascii_lowercase().as_str() {
        "12h" | "12_hours" => "12h",
        "weekly" | "7d" => "weekly",
        _ => "daily",
    }
}

pub fn parse_retention_days(raw: Option<&str>) -> u32 {
    match raw.and_then(|s| s.trim().parse::<u32>().ok()) {
        Some(14) => 14,
        Some(30) => 30,
        _ => 7,
    }
}

fn data_dir_from_state(state: &DbState) -> PathBuf {
    state
        .db_path
        .parent()
        .map(|p| p.to_path_buf())
        .unwrap_or_else(|| std::env::current_dir().unwrap_or_default())
}

fn backup_dir_from_data_dir(data_dir: &Path) -> PathBuf {
    data_dir.join("backups")
}

fn cache_dir_from_data_dir(data_dir: &Path) -> PathBuf {
    data_dir.join("cache")
}

fn read_setting_str(conn: &Connection, key: &str) -> Option<String> {
    conn.query_row(
        "SELECT value FROM settings WHERE key = ?1",
        params![key],
        |row| row.get::<_, String>(0),
    )
    .ok()
}

fn read_backup_policy(conn: &Connection) -> (bool, &'static str, u32, Option<i64>) {
    let enabled = read_setting_str(conn, "backup_enabled")
        .map(|v| v.trim().eq_ignore_ascii_case("true"))
        .unwrap_or(true);
    let frequency = read_setting_str(conn, "backup_frequency")
        .map(|v| normalize_frequency(&v))
        .unwrap_or("daily");
    let retention_days =
        parse_retention_days(read_setting_str(conn, "backup_retention_days").as_deref());
    let last_backup_at = read_setting_str(conn, "last_auto_backup_at")
        .and_then(|v| v.trim().parse::<i64>().ok())
        .filter(|&v| v > 0);
    (enabled, frequency, retention_days, last_backup_at)
}

fn build_backup_payload(conn: &Connection) -> Result<FullBackupData, String> {
    let integrity: String = conn
        .query_row("PRAGMA quick_check(1)", [], |row| row.get(0))
        .map_err(|e| format!("SQLite quick_check failed before backup: {}", e))?;
    if integrity != "ok" {
        return Err(format!("Database integrity check failed: {}", integrity));
    }

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

    let mut v_stmt = conn
        .prepare("SELECT id, note_id, title, content, created_at FROM note_versions ORDER BY created_at DESC LIMIT 1000")
        .map_err(|e| e.to_string())?;
    let note_versions: Vec<NoteVersion> = v_stmt
        .query_map([], |row| {
            Ok(NoteVersion {
                id: row.get(0)?,
                note_id: row.get(1)?,
                title: row.get(2)?,
                content: row.get(3)?,
                created_at: row.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(FullBackupData {
        version: 2,
        exported_at: chrono::Utc::now().timestamp_millis(),
        collections,
        notes,
        settings,
        note_versions,
    })
}

fn write_atomic_json_bytes(target_path: &Path, json_bytes: &[u8]) -> Result<(), String> {
    if let Some(parent) = target_path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Failed to prepare backup directory: {}", e))?;
    }
    let tmp_name = format!(
        ".{}.tmp",
        target_path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("nook_backup")
    );
    let tmp_path = target_path
        .parent()
        .unwrap_or_else(|| Path::new("."))
        .join(tmp_name);

    {
        let mut f = fs::File::create(&tmp_path)
            .map_err(|e| format!("Failed to create temporary backup file: {}", e))?;
        f.write_all(json_bytes)
            .map_err(|e| format!("Failed to write backup contents: {}", e))?;
        let _ = f.sync_all();
    }

    if target_path.exists() {
        let _ = fs::remove_file(target_path);
    }
    fs::rename(&tmp_path, target_path)
        .map_err(|e| format!("Failed to finalize backup file: {}", e))?;

    Ok(())
}

pub fn export_backup_json_from_conn(conn: &Connection, file_path: &Path) -> Result<(), String> {
    let backup = build_backup_payload(conn)?;
    let json_bytes = serde_json::to_vec_pretty(&backup).map_err(|e| e.to_string())?;
    write_atomic_json_bytes(file_path, &json_bytes)
}

pub fn import_backup_json_into_conn(
    conn: &mut Connection,
    file_path: &Path,
) -> Result<(usize, usize), String> {
    let content = fs::read_to_string(file_path)
        .map_err(|e| format!("Failed to read backup file: {}", e))?;

    let backup: FullBackupData = serde_json::from_str(&content)
        .map_err(|e| format!("Invalid backup format: {}", e))?;

    let tx = conn.transaction().map_err(|e| e.to_string())?;

    tx.execute("DELETE FROM note_versions", [])
        .map_err(|e| e.to_string())?;
    tx.execute("DELETE FROM notes", [])
        .map_err(|e| e.to_string())?;
    tx.execute("DELETE FROM collections", [])
        .map_err(|e| e.to_string())?;

    // Sort collections parent-first so hierarchical foreign keys insert cleanly
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
                )
                .map_err(|e| e.to_string())?;
                inserted_ids.insert(c.id.clone());
                progress = true;
            } else {
                next_remaining.push(c);
            }
        }

        if !progress {
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
                )
                .map_err(|e| e.to_string())?;
                inserted_ids.insert(c.id.clone());
            }
            break;
        }
        remaining = next_remaining;
    }

    let mut note_ids = std::collections::HashSet::new();
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
        )
        .map_err(|e| e.to_string())?;
        note_ids.insert(n.id.clone());
    }

    for v in &backup.note_versions {
        if note_ids.contains(&v.note_id) {
            tx.execute(
                "INSERT OR IGNORE INTO note_versions (id, note_id, title, content, created_at)
                 VALUES (?1, ?2, ?3, ?4, ?5)",
                params![v.id, v.note_id, v.title, v.content, v.created_at],
            )
            .map_err(|e| e.to_string())?;
        }
    }

    for s in &backup.settings {
        tx.execute(
            "INSERT OR REPLACE INTO settings (key, value) VALUES (?1, ?2)",
            params![s.key, s.value],
        )
        .map_err(|e| e.to_string())?;
    }

    tx.commit().map_err(|e| e.to_string())?;
    Ok((backup.collections.len(), backup.notes.len()))
}

fn scan_managed_auto_backups(backup_dir: &Path) -> Vec<AutoBackupInfo> {
    let mut list = Vec::new();
    if let Ok(entries) = fs::read_dir(backup_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file()
                && let Some(name) = path.file_name().and_then(|n| n.to_str())
                && is_managed_auto_backup_filename(name)
                && let Ok(meta) = entry.metadata()
            {
                let created_at = meta
                    .modified()
                    .ok()
                    .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                    .map(|d| d.as_millis() as i64)
                    .unwrap_or(0);
                list.push(AutoBackupInfo {
                    filename: name.to_string(),
                    path: path.to_string_lossy().to_string(),
                    size_bytes: meta.len(),
                    created_at,
                    is_auto: true,
                });
            }
        }
    }
    list.sort_by_key(|a| std::cmp::Reverse(a.created_at));
    list
}

fn prune_expired_auto_backups(
    backup_dir: &Path,
    retention_days: u32,
    now_ms: i64,
    keep_filename: Option<&str>,
) {
    let cutoff_ms = now_ms - (retention_days as i64) * MS_PER_DAY;
    let managed = scan_managed_auto_backups(backup_dir);
    for (idx, item) in managed.iter().enumerate() {
        // Always keep the newest backup created in this cycle cleanly
        if idx == 0 {
            continue;
        }
        if let Some(keep) = keep_filename
            && item.filename == keep
        {
            continue;
        }
        if item.created_at > 0 && item.created_at < cutoff_ms {
            let target = backup_dir.join(&item.filename);
            if target.is_file() && is_managed_auto_backup_filename(&item.filename) {
                let _ = fs::remove_file(target);
            }
        }
    }
}

pub fn trigger_auto_backup_with_paths(
    conn: &Connection,
    backup_dir: &Path,
    force: bool,
    now_ms: i64,
) -> Result<Option<AutoBackupInfo>, String> {
    let (enabled, frequency, retention_days, last_setting_ts) = read_backup_policy(conn);
    if !enabled && !force {
        return Ok(None);
    }

    let existing = scan_managed_auto_backups(backup_dir);
    let latest_file_ts = existing.first().map(|b| b.created_at).unwrap_or(0);
    let last_ts = std::cmp::max(last_setting_ts.unwrap_or(0), latest_file_ts);
    let interval_ms = parse_frequency_interval_ms(frequency);

    if !force && last_ts > 0 && (now_ms - last_ts) < interval_ms {
        // Still prune expired auto backups safely while respecting retention policy
        prune_expired_auto_backups(backup_dir, retention_days, now_ms, None);
        return Ok(None);
    }

    fs::create_dir_all(backup_dir).map_err(|e| format!("Failed to create backup dir: {}", e))?;

    let dt = chrono::DateTime::from_timestamp_millis(now_ms)
        .unwrap_or_else(chrono::Utc::now);
    let stamp = dt.format("%Y-%m-%d_%H-%M-%S").to_string();
    let filename = format!("nook_auto_backup_{}.json", stamp);
    let target_path = backup_dir.join(&filename);

    let backup = build_backup_payload(conn)?;
    let json_bytes = serde_json::to_vec_pretty(&backup).map_err(|e| e.to_string())?;
    write_atomic_json_bytes(&target_path, &json_bytes)?;

    let _ = DbQueries::set_setting(conn, "last_auto_backup_at", &now_ms.to_string());
    prune_expired_auto_backups(backup_dir, retention_days, now_ms, Some(&filename));

    let meta = fs::metadata(&target_path).map_err(|e| e.to_string())?;
    Ok(Some(AutoBackupInfo {
        filename,
        path: target_path.to_string_lossy().to_string(),
        size_bytes: meta.len(),
        created_at: now_ms,
        is_auto: true,
    }))
}

pub fn collect_auto_backups_summary(
    conn: &Connection,
    backup_dir: &Path,
    now_ms: i64,
) -> AutoBackupSummary {
    let (enabled, frequency, retention_days, last_setting_ts) = read_backup_policy(conn);
    let backups = scan_managed_auto_backups(backup_dir);
    let count = backups.len();
    let total_size_bytes: u64 = backups.iter().map(|b| b.size_bytes).sum();
    let latest_file_ts = backups.first().map(|b| b.created_at);
    let last_backup_at = match (last_setting_ts, latest_file_ts) {
        (Some(a), Some(b)) => Some(std::cmp::max(a, b)),
        (Some(a), None) => Some(a),
        (None, Some(b)) => Some(b),
        (None, None) => None,
    };

    let interval_ms = parse_frequency_interval_ms(frequency);
    let next_backup_at = if !enabled {
        None
    } else if let Some(last) = last_backup_at {
        Some(std::cmp::max(now_ms, last + interval_ms))
    } else {
        Some(now_ms)
    };

    AutoBackupSummary {
        enabled,
        frequency: frequency.to_string(),
        retention_days,
        count,
        total_size_bytes,
        last_backup_at,
        next_backup_at,
        backups,
    }
}

pub fn delete_managed_auto_backups(
    conn: &Connection,
    backup_dir: &Path,
) -> Result<DeleteBackupsResult, String> {
    if !backup_dir.exists() {
        return Ok(DeleteBackupsResult {
            deleted_count: 0,
            freed_bytes: 0,
        });
    }

    let canonical_dir = fs::canonicalize(backup_dir).map_err(|e| e.to_string())?;
    let managed = scan_managed_auto_backups(backup_dir);
    let mut deleted_count = 0usize;
    let mut freed_bytes = 0u64;

    for item in managed {
        if !is_managed_auto_backup_filename(&item.filename) {
            continue;
        }
        let candidate = backup_dir.join(&item.filename);
        let Ok(canon) = fs::canonicalize(&candidate) else {
            continue;
        };
        // Strict containment + non-symlink + filename safety guard
        if canon.parent() == Some(canonical_dir.as_path()) && canon.is_file() {
            let size = item.size_bytes;
            if fs::remove_file(&canon).is_ok() {
                deleted_count += 1;
                freed_bytes += size;
            }
        }
    }

    let _ = DbQueries::set_setting(conn, "last_auto_backup_at", "0");
    Ok(DeleteBackupsResult {
        deleted_count,
        freed_bytes,
    })
}

fn is_disposable_temp_file(path: &Path, in_cache_dir: bool) -> bool {
    let Some(name) = path.file_name().and_then(|n| n.to_str()) else {
        return false;
    };
    let lower = name.to_ascii_lowercase();
    // Never delete SQLite database, WAL, SHM, backup JSONs, or settings files
    if lower.ends_with(".db")
        || lower.ends_with(".db-wal")
        || lower.ends_with(".db-shm")
        || lower.ends_with(".sqlite")
        || lower.ends_with(".json")
    {
        return false;
    }
    if in_cache_dir {
        return true;
    }
    // In backups dir, only stale .tmp files older than 5 minutes are disposable
    if lower.ends_with(".tmp")
        && let Ok(meta) = fs::metadata(path)
        && let Ok(modified) = meta.modified()
        && let Ok(age) = std::time::SystemTime::now().duration_since(modified)
    {
        return age.as_secs() >= 300;
    }
    false
}

pub fn inspect_app_cache(data_dir: &Path) -> CacheStats {
    let cache_dir = cache_dir_from_data_dir(data_dir);
    let backup_dir = backup_dir_from_data_dir(data_dir);
    let mut size = 0u64;
    let mut count = 0usize;

    for (dir, is_cache_root) in [(&cache_dir, true), (&backup_dir, false)] {
        if let Ok(entries) = fs::read_dir(dir) {
            for entry in entries.flatten() {
                let p = entry.path();
                if p.is_file()
                    && is_disposable_temp_file(&p, is_cache_root)
                    && let Ok(meta) = entry.metadata()
                {
                    count += 1;
                    size += meta.len();
                }
            }
        }
    }

    CacheStats {
        cache_size_bytes: size,
        cache_file_count: count,
        cache_dir_path: cache_dir.to_string_lossy().to_string(),
        webview_requires_restart: true,
    }
}

pub fn clear_app_cache_dir(
    conn: &Connection,
    data_dir: &Path,
) -> Result<ClearCacheResult, String> {
    let cache_dir = cache_dir_from_data_dir(data_dir);
    let backup_dir = backup_dir_from_data_dir(data_dir);
    let mut deleted_files = 0usize;
    let mut freed_bytes = 0u64;

    for (dir, is_cache_root) in [(&cache_dir, true), (&backup_dir, false)] {
        if !dir.exists() {
            continue;
        }
        let Ok(canon_root) = fs::canonicalize(dir) else {
            continue;
        };
        if let Ok(entries) = fs::read_dir(dir) {
            for entry in entries.flatten() {
                let p = entry.path();
                if p.is_file() && is_disposable_temp_file(&p, is_cache_root) {
                    let Ok(canon) = fs::canonicalize(&p) else {
                        continue;
                    };
                    if canon.parent() == Some(canon_root.as_path())
                        && let Ok(meta) = entry.metadata()
                    {
                        let len = meta.len();
                        if fs::remove_file(&canon).is_ok() {
                            deleted_files += 1;
                            freed_bytes += len;
                        }
                    }
                }
            }
        }
    }

    // Safely checkpoint WAL journal without locking readers/writers
    let _ = conn.execute_batch("PRAGMA wal_checkpoint(PASSIVE);");

    Ok(ClearCacheResult {
        deleted_files,
        freed_bytes,
        webview_requires_restart: true,
    })
}

#[tauri::command]
pub fn get_database_path(state: State<'_, DbState>) -> String {
    state.db_path.to_string_lossy().to_string()
}

#[tauri::command]
pub fn export_backup_json(state: State<'_, DbState>, file_path: String) -> Result<(), String> {
    let backup = {
        let conn = state.conn.lock().map_err(|e| e.to_string())?;
        build_backup_payload(&conn)?
    };
    let json_bytes = serde_json::to_vec_pretty(&backup).map_err(|e| e.to_string())?;
    write_atomic_json_bytes(Path::new(&file_path), &json_bytes)
}

#[tauri::command]
pub fn import_backup_json(state: State<'_, DbState>, file_path: String) -> Result<String, String> {
    let mut conn = state.conn.lock().map_err(|e| e.to_string())?;
    let (col_count, note_count) = import_backup_json_into_conn(&mut conn, Path::new(&file_path))?;

    let lang = crate::commands::settings::get_active_language(&conn);
    let msg = match crate::commands::settings::normalize_lang(&lang) {
        "en" => format!(
            "Backup restored successfully! ({} collections, {} notes restored)",
            col_count, note_count
        ),
        "es" => format!(
            "¡Copia restaurada con éxito! ({} colecciones, {} notas restauradas)",
            col_count, note_count
        ),
        _ => format!(
            "Backup restaurado com sucesso! ({} coleções, {} notas restauradas)",
            col_count, note_count
        ),
    };

    Ok(msg)
}

#[tauri::command]
pub fn trigger_auto_backup(
    state: State<'_, DbState>,
    force: Option<bool>,
) -> Result<Option<AutoBackupInfo>, String> {
    let data_dir = data_dir_from_state(&state);
    let backup_dir = backup_dir_from_data_dir(&data_dir);
    let now_ms = chrono::Utc::now().timestamp_millis();
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    trigger_auto_backup_with_paths(&conn, &backup_dir, force.unwrap_or(false), now_ms)
}

#[tauri::command]
pub fn list_auto_backups(state: State<'_, DbState>) -> Result<Vec<AutoBackupInfo>, String> {
    let data_dir = data_dir_from_state(&state);
    let backup_dir = backup_dir_from_data_dir(&data_dir);
    Ok(scan_managed_auto_backups(&backup_dir))
}

#[tauri::command]
pub fn get_auto_backups_summary(state: State<'_, DbState>) -> Result<AutoBackupSummary, String> {
    let data_dir = data_dir_from_state(&state);
    let backup_dir = backup_dir_from_data_dir(&data_dir);
    let now_ms = chrono::Utc::now().timestamp_millis();
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    Ok(collect_auto_backups_summary(&conn, &backup_dir, now_ms))
}

#[tauri::command]
pub fn delete_auto_backups(state: State<'_, DbState>) -> Result<DeleteBackupsResult, String> {
    let data_dir = data_dir_from_state(&state);
    let backup_dir = backup_dir_from_data_dir(&data_dir);
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    delete_managed_auto_backups(&conn, &backup_dir)
}

#[tauri::command]
pub fn get_cache_stats(state: State<'_, DbState>) -> Result<CacheStats, String> {
    let data_dir = data_dir_from_state(&state);
    Ok(inspect_app_cache(&data_dir))
}

#[tauri::command]
pub fn clear_app_cache(state: State<'_, DbState>) -> Result<ClearCacheResult, String> {
    let data_dir = data_dir_from_state(&state);
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    clear_app_cache_dir(&conn, &data_dir)
}

/// Consistent SQLite online snapshot helper re-exported for backup integrity tests
pub fn export_consistent_sqlite_copy(
    conn: &Connection,
    dest_db_path: &Path,
) -> Result<(), String> {
    backup_sqlite_to_file(conn, dest_db_path)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::schema;

    fn make_temp_dir(prefix: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("{}_{}", prefix, uuid::Uuid::new_v4()));
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn test_sqlite_online_backup_creation_verification_and_restore() {
        let tmp = make_temp_dir("nook_sqlite_bak");
        let db_path = tmp.join("lumina_notes.db");
        let snapshot_path = tmp.join("backups").join("consistent.db");

        {
            let conn = Connection::open(&db_path).unwrap();
            schema::init_db(&conn).unwrap();
            let proj = DbQueries::create_collection(&conn, "Project One", "project", None).unwrap();
            DbQueries::create_note(&conn, Some(proj.id), Some("Alpha".into()), Some("Body 1".into())).unwrap();
            export_consistent_sqlite_copy(&conn, &snapshot_path).unwrap();
        }

        assert!(snapshot_path.exists());
        let restored = Connection::open(&snapshot_path).unwrap();
        let integrity: String = restored.query_row("PRAGMA integrity_check", [], |r| r.get(0)).unwrap();
        assert_eq!(integrity, "ok");
        let notes = DbQueries::list_active_notes(&restored).unwrap();
        assert_eq!(notes.len(), 1);
        assert_eq!(notes[0].title, "Alpha");

        let _ = fs::remove_dir_all(&tmp);
    }

    #[test]
    fn test_backup_schedule_retention_and_safe_auto_delete() {
        let tmp = make_temp_dir("nook_auto_bak_test");
        let db_path = tmp.join("lumina_notes.db");
        let backup_dir = tmp.join("backups");
        fs::create_dir_all(&backup_dir).unwrap();

        let conn = Connection::open(&db_path).unwrap();
        schema::init_db(&conn).unwrap();
        DbQueries::create_note(&conn, None, Some("Keep Me".into()), Some("Important text".into())).unwrap();
        DbQueries::set_setting(&conn, "backup_frequency", "12h").unwrap();
        DbQueries::set_setting(&conn, "backup_retention_days", "7").unwrap();

        // Create a manual backup & cache file that MUST NEVER be deleted by auto-backup pruning or delete_auto_backups
        let manual_path = backup_dir.join("my_manual_export.json");
        export_backup_json_from_conn(&conn, &manual_path).unwrap();

        let now_ms = chrono::Utc::now().timestamp_millis();
        let first = trigger_auto_backup_with_paths(&conn, &backup_dir, false, now_ms).unwrap();
        assert!(first.is_some());

        // Second check 2 hours later must respect 12h interval and skip
        let skipped = trigger_auto_backup_with_paths(&conn, &backup_dir, false, now_ms + 2 * MS_PER_HOUR).unwrap();
        assert!(skipped.is_none());

        // Simulate PC turned off for 13 hours -> next startup catches up!
        let catch_up = trigger_auto_backup_with_paths(&conn, &backup_dir, false, now_ms + 13 * MS_PER_HOUR).unwrap();
        assert!(catch_up.is_some());

        // Delete ONLY managed auto backups -> manual backup and main DB must stay untouched
        let del = delete_managed_auto_backups(&conn, &backup_dir).unwrap();
        assert!(del.deleted_count >= 1);
        assert!(manual_path.exists(), "Manual backup must NEVER be deleted");
        assert!(db_path.exists(), "Main SQLite database must NEVER be deleted");
        assert_eq!(DbQueries::list_active_notes(&conn).unwrap().len(), 1);

        // Restore from manual backup into clean DB verifies integrity roundtrip
        let mut restored_conn = Connection::open_in_memory().unwrap();
        schema::init_db(&restored_conn).unwrap();
        let (_, notes_restored) = import_backup_json_into_conn(&mut restored_conn, &manual_path).unwrap();
        assert_eq!(notes_restored, 1);

        let _ = fs::remove_dir_all(&tmp);
    }

    #[test]
    fn test_cache_clear_preserves_db_and_backups() {
        let tmp = make_temp_dir("nook_cache_test");
        let db_path = tmp.join("lumina_notes.db");
        let cache_dir = tmp.join("cache");
        let backup_dir = tmp.join("backups");
        fs::create_dir_all(&cache_dir).unwrap();
        fs::create_dir_all(&backup_dir).unwrap();

        let conn = Connection::open(&db_path).unwrap();
        schema::init_db(&conn).unwrap();
        DbQueries::create_note(&conn, None, Some("Safe".into()), Some("Data".into())).unwrap();

        let disposable_cache = cache_dir.join("render_preview.cache");
        fs::write(&disposable_cache, b"disposable-cache-bytes").unwrap();
        let protected_backup = backup_dir.join("nook_auto_backup_2026-11-18_00-00-00.json");
        export_backup_json_from_conn(&conn, &protected_backup).unwrap();

        let stats = inspect_app_cache(&tmp);
        assert_eq!(stats.cache_file_count, 1);

        let cleared = clear_app_cache_dir(&conn, &tmp).unwrap();
        assert_eq!(cleared.deleted_files, 1);
        assert!(!disposable_cache.exists());
        assert!(protected_backup.exists(), "Auto backup must never be cleared by cache cleanup");
        assert!(db_path.exists(), "Main SQLite DB must never be cleared by cache cleanup");

        let _ = fs::remove_dir_all(&tmp);
    }
}
