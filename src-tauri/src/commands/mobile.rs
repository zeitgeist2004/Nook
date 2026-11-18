use tauri::{AppHandle, Emitter, State};
use crate::commands::web::WebManagerState;
use crate::db::DbState;
use crate::db::models::AuthorizedDevice;
use crate::db::queries::DbQueries;
use crate::server::{self, PendingPairRequest, TunnelManager};

#[derive(Clone, Debug, serde::Serialize, serde::Deserialize)]
pub struct MobileAccessInfo {
    pub active: bool,
    pub connecting: bool,
    pub url: Option<String>,
    pub pair_code: Option<String>,
    pub qr_payload: Option<String>,
    pub error: Option<String>,
    pub authorized_devices: Vec<AuthorizedDevice>,
}

#[tauri::command]
pub async fn start_mobile_access(
    app: AppHandle,
    db: State<'_, DbState>,
    web_state: State<'_, WebManagerState>,
    tunnel_mgr: State<'_, TunnelManager>,
) -> Result<MobileAccessInfo, String> {
    tunnel_mgr.set_app_handle(app.clone()).await;

    // 1. Ensure local Axum web server is running
    let (port, pair_code) = {
        let mut guard = web_state.active_server.lock().await;
        if let Some(ref server) = *guard {
            let code = server.mobile_pair_manager.create_pair_code();
            (server.port, code)
        } else {
            let running = server::start_local_server((*db).clone(), web_state.ws_broadcast_tx.clone(), Some(app.clone()))
                .await
                .map_err(|e| format!("Falha ao iniciar servidor local do Nook: {}", e))?;
            let p = running.port;
            let code = running.mobile_pair_manager.create_pair_code();
            *guard = Some(crate::commands::web::ActiveServer {
                port: p,
                session_token: running.session_token,
                shutdown_tx: Some(running.shutdown_tx),
                auth_manager: running.auth_manager,
                mobile_pair_manager: running.mobile_pair_manager,
                allowed_tunnel_host: running.allowed_tunnel_host,
            });
            (p, code)
        }
    };

    // 2. Start Cloudflare Tunnel
    let tunnel_url = tunnel_mgr.start_tunnel(port, pair_code.clone()).await?;

    let qr_payload = format!("{}/mobile?pair={}", tunnel_url, pair_code);

    let devices = {
        let conn = db.conn.lock().map_err(|e| e.to_string())?;
        DbQueries::get_authorized_devices(&conn).unwrap_or_default()
    };

    let info = MobileAccessInfo {
        active: true,
        connecting: false,
        url: Some(tunnel_url),
        pair_code: Some(pair_code),
        qr_payload: Some(qr_payload),
        error: None,
        authorized_devices: devices,
    };

    let _ = app.emit("mobile-access-updated", &info);

    Ok(info)
}

#[tauri::command]
pub async fn stop_mobile_access(
    app: AppHandle,
    tunnel_mgr: State<'_, TunnelManager>,
) -> Result<(), String> {
    tunnel_mgr.stop_tunnel().await;

    let info = MobileAccessInfo {
        active: false,
        connecting: false,
        url: None,
        pair_code: None,
        qr_payload: None,
        error: None,
        authorized_devices: vec![],
    };

    let _ = app.emit("mobile-access-updated", &info);

    Ok(())
}

#[tauri::command]
pub async fn get_mobile_status(
    db: State<'_, DbState>,
    tunnel_mgr: State<'_, TunnelManager>,
) -> Result<MobileAccessInfo, String> {
    let st = tunnel_mgr.get_status().await;
    let qr_payload = if let (Some(u), Some(c)) = (&st.url, &st.pair_code) {
        Some(format!("{}/mobile?pair={}", u, c))
    } else {
        None
    };

    let devices = {
        let conn = db.conn.lock().map_err(|e| e.to_string())?;
        DbQueries::get_authorized_devices(&conn).unwrap_or_default()
    };

    Ok(MobileAccessInfo {
        active: st.active,
        connecting: st.connecting,
        url: st.url,
        pair_code: st.pair_code,
        qr_payload,
        error: st.error,
        authorized_devices: devices,
    })
}

#[tauri::command]
pub async fn get_mobile_devices(
    db: State<'_, DbState>,
) -> Result<Vec<AuthorizedDevice>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let devices = DbQueries::get_authorized_devices(&conn).map_err(|e| e.to_string())?;
    Ok(devices)
}

#[tauri::command]
pub async fn get_mobile_pending_pairings(
    web_state: State<'_, WebManagerState>,
) -> Result<Vec<PendingPairRequest>, String> {
    let guard = web_state.active_server.lock().await;
    if let Some(ref server) = *guard {
        Ok(server.mobile_pair_manager.get_pending_requests())
    } else {
        Ok(vec![])
    }
}

#[tauri::command]
pub async fn approve_mobile_pairing(
    app: AppHandle,
    db: State<'_, DbState>,
    web_state: State<'_, WebManagerState>,
    request_id: String,
) -> Result<AuthorizedDevice, String> {
    let (device_id, device_name, user_agent, session_token) = {
        let guard = web_state.active_server.lock().await;
        if let Some(ref server) = *guard {
            server.mobile_pair_manager.approve_pairing(&request_id)?
        } else {
            return Err("Servidor local não está em execução.".to_string());
        }
    };

    // Save authorized device in SQLite
    let device = {
        let conn = db.conn.lock().map_err(|e| e.to_string())?;
        DbQueries::create_authorized_device(&conn, &device_id, &device_name, &user_agent, &session_token, None)
            .map_err(|e| e.to_string())?;

        AuthorizedDevice {
            id: device_id,
            name: device_name,
            user_agent,
            token_hash: session_token,
            ip_hint: None,
            created_at: chrono::Utc::now().timestamp_millis(),
            last_active_at: chrono::Utc::now().timestamp_millis(),
            is_revoked: false,
        }
    };

    let _ = app.emit("nook-mobile-device-approved", &device);

    Ok(device)
}

#[tauri::command]
pub async fn reject_mobile_pairing(
    web_state: State<'_, WebManagerState>,
    request_id: String,
) -> Result<(), String> {
    let guard = web_state.active_server.lock().await;
    if let Some(ref server) = *guard {
        server.mobile_pair_manager.reject_pairing(&request_id)?;
    }
    Ok(())
}

#[tauri::command]
pub async fn revoke_mobile_device(
    app: AppHandle,
    db: State<'_, DbState>,
    device_id: String,
) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    DbQueries::revoke_authorized_device(&conn, &device_id).map_err(|e| e.to_string())?;

    let _ = app.emit("nook-mobile-device-revoked", &device_id);

    Ok(())
}

#[tauri::command]
pub async fn delete_mobile_device(
    app: AppHandle,
    db: State<'_, DbState>,
    device_id: String,
) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    DbQueries::delete_authorized_device(&conn, &device_id).map_err(|e| e.to_string())?;

    let _ = app.emit("nook-mobile-device-deleted", &device_id);

    Ok(())
}
