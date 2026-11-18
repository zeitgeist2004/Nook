use tauri::{AppHandle, Emitter, State};
use crate::commands::web::WebManagerState;
use crate::db::DbState;
use crate::db::models::SettingItem;
use crate::db::queries::DbQueries;

pub fn normalize_lang(raw: &str) -> &'static str {
    let lower = raw.trim().to_ascii_lowercase();
    if lower.starts_with("pt") {
        "pt"
    } else if lower.starts_with("es") {
        "es"
    } else {
        "en"
    }
}

pub fn get_active_language(conn: &rusqlite::Connection) -> String {
    DbQueries::get_settings(conn)
        .ok()
        .and_then(|items| items.into_iter().find(|s| s.key == "language"))
        .map(|s| normalize_lang(&s.value).to_string())
        .unwrap_or_else(|| "en".to_string())
}

/// Resolves tray language on startup while preserving legacy Portuguese installations
/// that existed prior to multi-language settings storage.
pub fn get_initial_tray_language(conn: &rusqlite::Connection) -> String {
    if let Ok(items) = DbQueries::get_settings(conn)
        && let Some(lang_setting) = items.into_iter().find(|s| s.key == "language")
    {
        return normalize_lang(&lang_setting.value).to_string();
    }
    let existing_count: i64 = conn
        .query_row(
            "SELECT (SELECT COUNT(*) FROM notes) + (SELECT COUNT(*) FROM collections)",
            [],
            |r| r.get(0),
        )
        .unwrap_or(0);
    if existing_count > 0 {
        "pt".to_string()
    } else {
        "en".to_string()
    }
}

pub fn pick_lang<'a>(lang: &str, pt: &'a str, en: &'a str, es: &'a str) -> &'a str {
    match normalize_lang(lang) {
        "en" => en,
        "es" => es,
        _ => pt,
    }
}

#[tauri::command]
pub fn get_settings(state: State<'_, DbState>) -> Result<Vec<SettingItem>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    DbQueries::get_settings(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_setting(
    app: AppHandle,
    state: State<'_, DbState>,
    web_state: State<'_, WebManagerState>,
    key: String,
    value: String,
) -> Result<(), String> {
    {
        let conn = state.conn.lock().map_err(|e| e.to_string())?;
        DbQueries::set_setting(&conn, &key, &value).map_err(|e| e.to_string())?;
    }

    if key == "language" {
        crate::apply_tray_language(&app, &value);
    }

    let payload = serde_json::json!({
        "event": "settings.updated",
        "type": "settings.updated",
        "data": { "key": &key, "value": &value },
        "payload": { "key": &key, "value": &value },
        "origin": "desktop",
        "timestamp": chrono::Utc::now().timestamp_millis(),
    });

    let _ = web_state.ws_broadcast_tx.send(payload.to_string());
    let _ = app.emit("nook-sync", &payload);

    Ok(())
}
