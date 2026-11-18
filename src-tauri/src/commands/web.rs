use tauri::{AppHandle, Emitter, Manager, State};
use tokio::sync::{broadcast, oneshot, Mutex as TokioMutex};

use crate::db::DbState;
use crate::server::{self, AuthManager, MobilePairManager};

pub struct ActiveServer {
    pub port: u16,
    pub session_token: String,
    pub shutdown_tx: Option<oneshot::Sender<()>>,
    pub auth_manager: AuthManager,
    pub mobile_pair_manager: MobilePairManager,
    pub allowed_tunnel_host: std::sync::Arc<std::sync::Mutex<Option<String>>>,
}

pub struct WebManagerState {
    pub active_server: TokioMutex<Option<ActiveServer>>,
    pub ws_broadcast_tx: broadcast::Sender<String>,
}

impl Default for WebManagerState {
    fn default() -> Self {
        Self::new()
    }
}

impl WebManagerState {
    pub fn new() -> Self {
        let (ws_broadcast_tx, _) = broadcast::channel(128);
        Self {
            active_server: TokioMutex::new(None),
            ws_broadcast_tx,
        }
    }

    pub fn is_running_sync(&self) -> bool {
        if let Ok(guard) = self.active_server.try_lock() {
            guard.is_some()
        } else {
            true
        }
    }
}

#[derive(Clone, serde::Serialize)]
pub struct WebStatus {
    pub running: bool,
    pub port: Option<u16>,
    pub url: Option<String>,
}

#[tauri::command]
pub async fn get_web_status(
    state: State<'_, WebManagerState>,
) -> Result<WebStatus, String> {
    let guard = state.active_server.lock().await;
    if let Some(ref server) = *guard {
        Ok(WebStatus {
            running: true,
            port: Some(server.port),
            url: Some(format!("http://127.0.0.1:{}", server.port)),
        })
    } else {
        Ok(WebStatus {
            running: false,
            port: None,
            url: None,
        })
    }
}

#[tauri::command]
pub async fn start_web_server(
    app: AppHandle,
    db: State<'_, DbState>,
    web_state: State<'_, WebManagerState>,
) -> Result<WebStatus, String> {
    let mut guard = web_state.active_server.lock().await;
    
    if let Some(ref server) = *guard {
        return Ok(WebStatus {
            running: true,
            port: Some(server.port),
            url: Some(format!("http://127.0.0.1:{}", server.port)),
        });
    }

    let running = server::start_local_server((*db).clone(), web_state.ws_broadcast_tx.clone(), Some(app.clone()))
        .await
        .map_err(|e| format!("Failed to start Nook local server: {}", e))?;

    let port = running.port;
    let session_token = running.session_token;
    let shutdown_tx = running.shutdown_tx;
    let auth_manager = running.auth_manager;

    *guard = Some(ActiveServer {
        port,
        session_token,
        shutdown_tx: Some(shutdown_tx),
        auth_manager,
        mobile_pair_manager: running.mobile_pair_manager,
        allowed_tunnel_host: running.allowed_tunnel_host,
    });

    let _ = app.emit("web-server-status", WebStatus {
        running: true,
        port: Some(port),
        url: Some(format!("http://127.0.0.1:{}", port)),
    });

    Ok(WebStatus {
        running: true,
        port: Some(port),
        url: Some(format!("http://127.0.0.1:{}", port)),
    })
}

#[tauri::command]
pub async fn stop_web_server(
    app: AppHandle,
    web_state: State<'_, WebManagerState>,
) -> Result<bool, String> {
    let mut guard = web_state.active_server.lock().await;
    if let Some(mut server) = guard.take() {
        if let Some(shutdown) = server.shutdown_tx.take() {
            let _ = shutdown.send(());
        }
        let _ = app.emit("web-server-status", WebStatus {
            running: false,
            port: None,
            url: None,
        });
        Ok(true)
    } else {
        Ok(false)
    }
}

pub fn open_browser_url(url: &str) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        std::process::Command::new("cmd")
            .args(["/c", "start", "", url])
            .creation_flags(CREATE_NO_WINDOW)
            .spawn()
            .map_err(|e| format!("Failed to launch default browser: {}", e))?;
        Ok(())
    }
    #[cfg(not(target_os = "windows"))]
    {
        std::process::Command::new("xdg-open")
            .arg(url)
            .spawn()
            .map_err(|e| format!("Failed to launch browser: {}", e))?;
        Ok(())
    }
}

#[tauri::command]
pub async fn open_nook_web(
    app: AppHandle,
    db: State<'_, DbState>,
    web_state: State<'_, WebManagerState>,
) -> Result<String, String> {
    // 1. Ensure server is started
    let (port, auth_mgr) = {
        let mut guard = web_state.active_server.lock().await;
        if let Some(ref server) = *guard {
            (server.port, server.auth_manager.clone())
        } else {
            let running = server::start_local_server((*db).clone(), web_state.ws_broadcast_tx.clone(), Some(app.clone()))
                .await
                .map_err(|e| format!("Failed to start Nook local server: {}", e))?;
            let p = running.port;
            let mgr = running.auth_manager.clone();
            *guard = Some(ActiveServer {
                port: p,
                session_token: running.session_token,
                shutdown_tx: Some(running.shutdown_tx),
                auth_manager: mgr.clone(),
                mobile_pair_manager: running.mobile_pair_manager,
                allowed_tunnel_host: running.allowed_tunnel_host,
            });
            (p, mgr)
        }
    };

    // 2. Generate a new one-time token using the shared AuthManager
    let new_token = auth_mgr.create_token();

    let auth_url = format!("http://127.0.0.1:{}/auth/verify?token={}", port, new_token);

    // 3. Launch default Windows browser
    open_browser_url(&auth_url)?;

    // 4. Hide main window to system tray once browser is launched successfully
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.hide();
    }

    Ok(auth_url)
}

pub const OFFICIAL_SPONSORS_URL: &str = "https://github.com/sponsors/zeitgeist2004";

/// Opens ONLY the hardcoded official GitHub Sponsors page in the user's default browser
/// while keeping Nook open and without modifying notes or state.
#[tauri::command]
pub fn open_sponsors_page() -> Result<String, String> {
    open_browser_url(OFFICIAL_SPONSORS_URL)?;
    Ok(OFFICIAL_SPONSORS_URL.to_string())
}
