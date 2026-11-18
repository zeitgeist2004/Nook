use crate::commands::web::WebManagerState;
use crate::db::DbState;
use crate::db::models::{Note, NoteSummary, SaveNoteResponse};
use crate::db::queries::DbQueries;
use tauri::State;

#[tauri::command]
pub fn get_active_notes(state: State<'_, DbState>) -> Result<Vec<NoteSummary>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    DbQueries::list_active_notes(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_note_by_id(state: State<'_, DbState>, id: String) -> Result<Option<Note>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    DbQueries::get_note_by_id(&conn, &id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_note(
    state: State<'_, DbState>,
    web_state: State<'_, WebManagerState>,
    collection_id: Option<String>,
    title: Option<String>,
    content: Option<String>,
) -> Result<Note, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let note = DbQueries::create_note(&conn, collection_id, title, content).map_err(|e| e.to_string())?;

    let event_payload = serde_json::json!({
        "event": "note.created",
        "data": &note,
    });
    let _ = web_state.ws_broadcast_tx.send(event_payload.to_string());

    Ok(note)
}

#[tauri::command]
pub fn save_note(
    state: State<'_, DbState>,
    web_state: State<'_, WebManagerState>,
    id: String,
    title: String,
    content: String,
    version: i64,
    base_updated_at: Option<i64>,
) -> Result<SaveNoteResponse, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;

    // Conflict detection and auto-backup:
    // Compare against the client's known updated_at watermark (ignoring monotonic save counters 1, 2, 3...)
    const EPOCH_MS_THRESHOLD: i64 = 1_000_000_000_000;
    let watermark = base_updated_at.or(if version >= EPOCH_MS_THRESHOLD {
        Some(version)
    } else {
        None
    });

    if let Some(expected_updated_at) = watermark
        && let Ok(Some(existing)) = DbQueries::get_note_by_id(&conn, &id)
        && existing.updated_at > expected_updated_at
        && existing.content != content
    {
        let lang = crate::commands::settings::get_active_language(&conn);
        let conflict_label = crate::commands::settings::pick_lang(
            &lang,
            "Conflito Sincronizado",
            "Synced Conflict",
            "Conflicto Sincronizado",
        );
        let _ = DbQueries::create_note_version(
            &conn,
            &id,
            &format!("{} ({})", existing.title, conflict_label),
            &existing.content,
        );
    }

    let updated_at =
        DbQueries::save_note_content(&conn, &id, &title, &content).map_err(|e| e.to_string())?;

    let event_payload = serde_json::json!({
        "event": "note.saved",
        "data": {
            "id": &id,
            "title": &title,
            "content": &content,
            "version": version,
            "updated_at": updated_at,
        }
    });
    let _ = web_state.ws_broadcast_tx.send(event_payload.to_string());

    Ok(SaveNoteResponse {
        success: true,
        id,
        version,
        updated_at,
    })
}

#[tauri::command]
pub fn update_note_title(
    state: State<'_, DbState>,
    web_state: State<'_, WebManagerState>,
    id: String,
    title: String,
) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    DbQueries::update_note_title(&conn, &id, &title).map_err(|e| e.to_string())?;

    let event_payload = serde_json::json!({
        "event": "note.title_updated",
        "data": { "id": &id, "title": &title },
    });
    let _ = web_state.ws_broadcast_tx.send(event_payload.to_string());

    Ok(())
}

#[tauri::command]
pub fn duplicate_note(
    state: State<'_, DbState>,
    web_state: State<'_, WebManagerState>,
    id: String,
) -> Result<Option<Note>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let note = DbQueries::duplicate_note(&conn, &id).map_err(|e| e.to_string())?;

    if let Some(ref n) = note {
        let event_payload = serde_json::json!({
            "event": "note.created",
            "data": n,
        });
        let _ = web_state.ws_broadcast_tx.send(event_payload.to_string());
    }

    Ok(note)
}

#[tauri::command]
pub fn move_note(
    state: State<'_, DbState>,
    web_state: State<'_, WebManagerState>,
    id: String,
    target_collection_id: Option<String>,
) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    DbQueries::move_note(&conn, &id, target_collection_id.clone()).map_err(|e| e.to_string())?;

    let event_payload = serde_json::json!({
        "event": "note.moved",
        "data": { "id": &id, "target_collection_id": target_collection_id },
    });
    let _ = web_state.ws_broadcast_tx.send(event_payload.to_string());

    Ok(())
}

#[tauri::command]
pub fn toggle_pin_note(
    state: State<'_, DbState>,
    web_state: State<'_, WebManagerState>,
    id: String,
) -> Result<bool, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let is_pinned = DbQueries::toggle_pin_note(&conn, &id).map_err(|e| e.to_string())?;

    let event_payload = serde_json::json!({
        "event": "note.pinned",
        "data": { "id": &id, "is_pinned": is_pinned },
    });
    let _ = web_state.ws_broadcast_tx.send(event_payload.to_string());

    Ok(is_pinned)
}

#[tauri::command]
pub fn soft_delete_note(
    state: State<'_, DbState>,
    web_state: State<'_, WebManagerState>,
    id: String,
) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    DbQueries::soft_delete_note(&conn, &id).map_err(|e| e.to_string())?;

    let event_payload = serde_json::json!({
        "event": "note.deleted",
        "data": { "id": &id },
    });
    let _ = web_state.ws_broadcast_tx.send(event_payload.to_string());

    Ok(())
}

#[tauri::command]
pub fn restore_note(
    state: State<'_, DbState>,
    web_state: State<'_, WebManagerState>,
    id: String,
) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    DbQueries::restore_note(&conn, &id).map_err(|e| e.to_string())?;

    let event_payload = serde_json::json!({
        "event": "note.restored",
        "data": { "id": &id },
    });
    let _ = web_state.ws_broadcast_tx.send(event_payload.to_string());

    Ok(())
}

#[tauri::command]
pub fn permanent_delete_note(
    state: State<'_, DbState>,
    web_state: State<'_, WebManagerState>,
    id: String,
) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    DbQueries::permanent_delete_note(&conn, &id).map_err(|e| e.to_string())?;

    let event_payload = serde_json::json!({
        "event": "note.permanent_deleted",
        "data": { "id": &id },
    });
    let _ = web_state.ws_broadcast_tx.send(event_payload.to_string());

    Ok(())
}

#[tauri::command]
pub fn get_trash_notes(state: State<'_, DbState>) -> Result<Vec<NoteSummary>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    DbQueries::list_trash_notes(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn empty_trash(
    state: State<'_, DbState>,
    web_state: State<'_, WebManagerState>,
) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    DbQueries::empty_trash(&conn).map_err(|e| e.to_string())?;

    let event_payload = serde_json::json!({
        "event": "trash.emptied",
        "data": {},
    });
    let _ = web_state.ws_broadcast_tx.send(event_payload.to_string());

    Ok(())
}

#[tauri::command]
pub fn get_note_versions(
    state: State<'_, DbState>,
    note_id: String,
) -> Result<Vec<crate::db::models::NoteVersion>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    DbQueries::list_note_versions(&conn, &note_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn restore_note_version(
    state: State<'_, DbState>,
    web_state: State<'_, WebManagerState>,
    note_id: String,
    version_id: String,
) -> Result<Option<Note>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let note = DbQueries::restore_note_version(&conn, &note_id, &version_id).map_err(|e| e.to_string())?;

    if let Some(ref n) = note {
        let event_payload = serde_json::json!({
            "event": "note.restored_version",
            "data": n,
        });
        let _ = web_state.ws_broadcast_tx.send(event_payload.to_string());
    }

    Ok(note)
}

#[tauri::command]
pub fn create_note_version(
    state: State<'_, DbState>,
    note_id: String,
    title: String,
    content: String,
) -> Result<crate::db::models::NoteVersion, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    DbQueries::create_note_version(&conn, &note_id, &title, &content).map_err(|e| e.to_string())
}
