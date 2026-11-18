pub mod routes;
pub mod security;
pub mod state;
pub mod tunnel;
pub mod ws;

use axum::routing::{delete, get, post};
use axum::Router;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use tokio::net::TcpListener;
use tokio::sync::{broadcast, oneshot};
use tower_http::services::{ServeDir, ServeFile};
use uuid::Uuid;

use crate::db::DbState;
pub use state::{AuthManager, MobilePairManager, PendingPairRequest, ServerState};
pub use tunnel::{TunnelManager, TunnelStatus};

pub struct RunningServer {
    pub port: u16,
    pub session_token: String,
    pub auth_manager: AuthManager,
    pub mobile_pair_manager: MobilePairManager,
    pub allowed_tunnel_host: Arc<Mutex<Option<String>>>,
    pub shutdown_tx: oneshot::Sender<()>,
}

pub fn find_dist_path() -> PathBuf {
    // 1. Check relative to executable
    if let Ok(exe_path) = std::env::current_exe()
        && let Some(exe_dir) = exe_path.parent()
    {
        let p = exe_dir.join("dist");
        if p.exists() && p.join("index.html").exists() {
            return p;
        }
    }
    // 2. Check current working directory
    if let Ok(cwd) = std::env::current_dir() {
        let p = cwd.join("dist");
        if p.exists() && p.join("index.html").exists() {
            return p;
        }
        let p_up = cwd.join("../dist");
        if p_up.exists() && p_up.join("index.html").exists() {
            return p_up;
        }
    }
    // 3. Fallback relative dist directory
    PathBuf::from("dist")
}

pub async fn start_local_server(
    db: DbState,
    ws_broadcast_tx: broadcast::Sender<String>,
    app_handle: Option<tauri::AppHandle>,
) -> Result<RunningServer, Box<dyn std::error::Error + Send + Sync>> {
    // Bind exclusively to loopback 127.0.0.1 on an available OS port
    let listener = TcpListener::bind("127.0.0.1:0").await?;
    let local_addr = listener.local_addr()?;
    let port = local_addr.port();

    let session_token = format!("{}-{}", Uuid::new_v4(), Uuid::new_v4());
    let auth_manager = AuthManager::new();
    let mobile_pair_manager = MobilePairManager::new();
    let allowed_tunnel_host = Arc::new(Mutex::new(None));

    let dist_path = find_dist_path();
    let index_file = dist_path.join("index.html");

    let server_state = ServerState {
        db,
        port,
        session_token: session_token.clone(),
        auth_manager: auth_manager.clone(),
        mobile_pair_manager: mobile_pair_manager.clone(),
        allowed_tunnel_host: allowed_tunnel_host.clone(),
        dist_path: dist_path.clone(),
        ws_broadcast_tx,
        app_handle,
    };

    let serve_dir = ServeDir::new(&dist_path).fallback(ServeFile::new(index_file));

    let app = Router::new()
        // Auth entry point
        .route("/auth/verify", get(routes::auth_verify))
        // Status & Ping
        .route("/api/status", get(routes::get_status))
        // Window restore (from browser tab or button to Desktop EXE)
        .route("/api/app/restore", post(routes::restore_app_window).get(routes::restore_app_window))
        // Notes API
        .route("/api/notes", get(routes::get_active_notes).post(routes::create_note))
        .route("/api/notes/{id}", get(routes::get_note_by_id).delete(routes::soft_delete_note))
        .route("/api/notes/save", post(routes::save_note))
        .route("/api/notes/title", post(routes::update_note_title))
        .route("/api/notes/pin", post(routes::toggle_pin_note))
        .route("/api/notes/duplicate", post(routes::duplicate_note))
        .route("/api/notes/move", post(routes::move_note))
        .route("/api/notes/{id}/restore", post(routes::restore_note))
        .route("/api/notes/{id}/permanent", delete(routes::permanent_delete_note))
        .route("/api/trash", get(routes::get_trash_notes).delete(routes::empty_trash))
        .route("/api/trash/collections", get(routes::get_trash_collections))
        // Versions API
        .route("/api/notes/{id}/versions", get(routes::get_note_versions).post(routes::create_note_version))
        .route("/api/notes/{id}/versions/restore", post(routes::restore_note_version))
        // Collections API
        .route("/api/collections", get(routes::get_collections).post(routes::create_collection))
        .route("/api/collections/rename", post(routes::rename_collection))
        .route("/api/collections/move", post(routes::move_collection))
        .route("/api/collections/reorder", post(routes::reorder_collections))
        .route("/api/collections/{id}", delete(routes::delete_collection))
        .route("/api/collections/{id}/restore", post(routes::restore_collection))
        // Search & Settings API
        .route("/api/search", get(routes::search_notes))
        .route("/api/settings", get(routes::get_settings).post(routes::save_setting))
        // Nook Mobile & Pairing API
        .route("/mobile", get(routes::mobile_entry_redirect))
        .route("/api/mobile/pair/request", post(routes::mobile_request_pairing))
        .route("/api/mobile/pair/poll", get(routes::mobile_poll_pairing))
        .route("/api/mobile/devices", get(routes::mobile_get_devices))
        .route("/api/mobile/devices/{id}/revoke", post(routes::mobile_revoke_device))
        .route("/api/mobile/devices/{id}/delete", delete(routes::mobile_delete_device))
        // Real-time WebSocket
        .route("/ws", get(ws::ws_handler))
        // Fallback to static files
        .fallback_service(serve_dir)
        .with_state(server_state);

    let (shutdown_tx, shutdown_rx) = oneshot::channel::<()>();

    tokio::spawn(async move {
        let _ = axum::serve(listener, app)
            .with_graceful_shutdown(async move {
                let _ = shutdown_rx.await;
            })
            .await;
    });

    Ok(RunningServer {
        port,
        session_token,
        auth_manager,
        mobile_pair_manager,
        allowed_tunnel_host,
        shutdown_tx,
    })
}
