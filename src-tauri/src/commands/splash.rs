use tauri::AppHandle;

#[tauri::command]
pub async fn close_splashscreen(_app: AppHandle) -> Result<(), String> {
    Ok(())
}
