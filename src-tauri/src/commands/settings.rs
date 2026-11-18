use tauri::{AppHandle, Emitter, State};
use crate::commands::web::WebManagerState;
use crate::db::DbState;
use crate::db::models::SettingItem;
use crate::db::queries::DbQueries;

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
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    DbQueries::set_setting(&conn, &key, &value).map_err(|e| e.to_string())?;

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
