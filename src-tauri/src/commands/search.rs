use crate::db::DbState;
use crate::db::models::SearchResultItem;
use crate::db::queries::DbQueries;
use tauri::State;

#[tauri::command]
pub fn search_notes(
    state: State<'_, DbState>,
    query: String,
) -> Result<Vec<SearchResultItem>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    DbQueries::search(&conn, &query).map_err(|e| e.to_string())
}
