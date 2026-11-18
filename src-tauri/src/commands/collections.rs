use crate::commands::web::WebManagerState;
use crate::db::DbState;
use crate::db::models::Collection;
use crate::db::queries::DbQueries;
use tauri::State;

fn broadcast_collection_event(web_state: &State<'_, WebManagerState>, event: &str, data: serde_json::Value) {
    let payload = serde_json::json!({
        "event": event,
        "data": data,
    });
    let _ = web_state.ws_broadcast_tx.send(payload.to_string());
}

#[tauri::command]
pub fn get_collections(state: State<'_, DbState>) -> Result<Vec<Collection>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    DbQueries::list_active_collections(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_collection(
    state: State<'_, DbState>,
    web_state: State<'_, WebManagerState>,
    name: String,
    collection_type: String,
    parent_id: Option<String>,
) -> Result<Collection, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let col = DbQueries::create_collection(&conn, &name, &collection_type, parent_id)
        .map_err(|e| e.to_string())?;
    broadcast_collection_event(
        &web_state,
        "collection.created",
        serde_json::to_value(&col).unwrap_or_default(),
    );
    Ok(col)
}

#[tauri::command]
pub fn update_collection_name(
    state: State<'_, DbState>,
    web_state: State<'_, WebManagerState>,
    id: String,
    name: String,
) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    DbQueries::update_collection_name(&conn, &id, &name).map_err(|e| e.to_string())?;
    broadcast_collection_event(
        &web_state,
        "collection.renamed",
        serde_json::json!({ "id": &id, "name": &name }),
    );
    Ok(())
}

#[tauri::command]
pub fn move_collection(
    state: State<'_, DbState>,
    web_state: State<'_, WebManagerState>,
    id: String,
    target_parent_id: Option<String>,
) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    DbQueries::move_collection(&conn, &id, target_parent_id.clone())?;
    broadcast_collection_event(
        &web_state,
        "collection.moved",
        serde_json::json!({ "id": &id, "target_parent_id": target_parent_id }),
    );
    Ok(())
}

#[tauri::command]
pub fn reorder_collections(
    state: State<'_, DbState>,
    web_state: State<'_, WebManagerState>,
    ordered_ids: Vec<String>,
) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    DbQueries::reorder_collections(&conn, &ordered_ids).map_err(|e| e.to_string())?;
    broadcast_collection_event(
        &web_state,
        "collection.reordered",
        serde_json::json!({ "ordered_ids": &ordered_ids }),
    );
    Ok(())
}

#[tauri::command]
pub fn delete_collection(
    state: State<'_, DbState>,
    web_state: State<'_, WebManagerState>,
    id: String,
) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    DbQueries::soft_delete_collection(&conn, &id).map_err(|e| e.to_string())?;
    broadcast_collection_event(
        &web_state,
        "collection.deleted",
        serde_json::json!({ "id": &id }),
    );
    Ok(())
}

#[tauri::command]
pub fn restore_collection(
    state: State<'_, DbState>,
    web_state: State<'_, WebManagerState>,
    id: String,
) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    DbQueries::restore_collection(&conn, &id).map_err(|e| e.to_string())?;
    broadcast_collection_event(
        &web_state,
        "collection.restored",
        serde_json::json!({ "id": &id }),
    );
    Ok(())
}

#[tauri::command]
pub fn get_trash_collections(state: State<'_, DbState>) -> Result<Vec<Collection>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    DbQueries::list_trash_collections(&conn).map_err(|e| e.to_string())
}
