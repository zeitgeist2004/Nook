use std::path::PathBuf;
use std::process::Stdio;
use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;
use tokio::sync::Mutex as TokioMutex;

#[derive(Clone, Debug, serde::Serialize, serde::Deserialize)]
pub struct TunnelStatus {
    pub active: bool,
    pub connecting: bool,
    pub url: Option<String>,
    pub pair_code: Option<String>,
    pub error: Option<String>,
}

#[derive(Clone)]
pub struct TunnelManager {
    stop_tx: Arc<TokioMutex<Option<tokio::sync::oneshot::Sender<()>>>>,
    status: Arc<TokioMutex<TunnelStatus>>,
    allowed_host: Arc<std::sync::Mutex<Option<String>>>,
    app_handle: Arc<TokioMutex<Option<AppHandle>>>,
}

impl TunnelManager {
    pub fn new(allowed_host: Arc<std::sync::Mutex<Option<String>>>) -> Self {
        Self {
            stop_tx: Arc::new(TokioMutex::new(None)),
            status: Arc::new(TokioMutex::new(TunnelStatus {
                active: false,
                connecting: false,
                url: None,
                pair_code: None,
                error: None,
            })),
            allowed_host,
            app_handle: Arc::new(TokioMutex::new(None)),
        }
    }

    pub async fn set_app_handle(&self, handle: AppHandle) {
        let mut guard = self.app_handle.lock().await;
        *guard = Some(handle);
    }

    pub fn find_cloudflared_binary() -> Option<PathBuf> {
        // 1. Current executable directory (production release sidecar)
        if let Ok(exe_path) = std::env::current_exe()
            && let Some(exe_dir) = exe_path.parent()
        {
            let p1 = exe_dir.join("cloudflared.exe");
            if p1.exists() {
                return Some(p1);
            }
            let p2 = exe_dir.join("bin").join("cloudflared.exe");
            if p2.exists() {
                return Some(p2);
            }
        }

        // 2. Relative project/workspace directories and standard installations
        let dev_paths = [
            PathBuf::from("src-tauri").join("bin").join("cloudflared.exe"),
            PathBuf::from("bin").join("cloudflared.exe"),
            PathBuf::from("release").join("cloudflared.exe"),
            PathBuf::from("cloudflared.exe"),
            PathBuf::from("C:\\Program Files (x86)\\cloudflared\\cloudflared.exe"),
            PathBuf::from("C:\\Program Files\\cloudflared\\cloudflared.exe"),
        ];

        for p in &dev_paths {
            if p.exists() {
                return Some(p.clone());
            }
        }

        None
    }

    fn spawn_log_monitor<R>(
        reader_opt: Option<R>,
        status_arc: Arc<TokioMutex<TunnelStatus>>,
        allowed_host_arc: Arc<std::sync::Mutex<Option<String>>>,
        app_handle_arc: Arc<TokioMutex<Option<AppHandle>>>,
        url_tx: Arc<TokioMutex<Option<tokio::sync::oneshot::Sender<String>>>>,
    ) where
        R: tokio::io::AsyncRead + Unpin + Send + 'static,
    {
        tokio::spawn(async move {
            let Some(pipe) = reader_opt else { return; };
            let mut lines = BufReader::new(pipe).lines();
            let mut found_url = false;

            while let Ok(Some(line)) = lines.next_line().await {
                if found_url || !line.contains("trycloudflare.com") {
                    continue;
                }
                for word in line.split_whitespace() {
                    let clean = word.trim_matches(|c| {
                        matches!(c, '|' | '(' | ')' | '[' | ']' | '<' | '>')
                    });
                    if clean.starts_with("https://") && clean.contains("trycloudflare.com") {
                        let tunnel_url = clean.to_string();
                        found_url = true;

                        if let Ok(mut host_guard) = allowed_host_arc.lock() {
                            *host_guard = Some(tunnel_url.clone());
                        }

                        {
                            let mut st = status_arc.lock().await;
                            st.active = true;
                            st.connecting = false;
                            st.url = Some(tunnel_url.clone());
                            st.error = None;
                        }

                        if let Some(tx) = url_tx.lock().await.take() {
                            let _ = tx.send(tunnel_url.clone());
                        }

                        let guard = app_handle_arc.lock().await;
                        if let Some(ref app) = *guard {
                            let st = status_arc.lock().await;
                            let _ = app.emit("mobile-tunnel-status", &*st);
                        }
                        // Do NOT break: keep draining pipe lines so Windows cloudflared won't exit on ERROR_BROKEN_PIPE
                    }
                }
            }
        });
    }

    pub async fn start_tunnel(&self, local_port: u16, pair_code: String) -> Result<String, String> {
        // If already active and healthy, return current URL
        {
            let st = self.status.lock().await;
            if st.active
                && let Some(ref u) = st.url
            {
                return Ok(u.clone());
            }
        }

        // Stop any previous instance first
        self.stop_tunnel().await;

        let bin_path = Self::find_cloudflared_binary()
            .ok_or_else(|| "Componente cloudflared.exe não encontrado no sistema.".to_string())?;

        // Update status to connecting
        {
            let mut st = self.status.lock().await;
            st.connecting = true;
            st.active = false;
            st.url = None;
            st.pair_code = Some(pair_code.clone());
            st.error = None;
        }
        self.emit_status().await;

        let mut cmd = Command::new(bin_path);
        cmd.args([
            "tunnel",
            "--url",
            &format!("http://127.0.0.1:{}", local_port),
            "--no-autoupdate",
        ]);
        cmd.stdout(Stdio::piped());
        cmd.stderr(Stdio::piped());

        #[cfg(windows)]
        {
            // CREATE_NO_WINDOW flag (0x08000000) on Windows to prevent console popup window
            cmd.creation_flags(0x08000000);
        }

        let mut child = cmd.spawn().map_err(|e| format!("Falha ao iniciar processo cloudflared: {}", e))?;

        let stderr = child.stderr.take();
        let stdout = child.stdout.take();

        let (stop_tx, mut stop_rx) = tokio::sync::oneshot::channel::<()>();
        {
            let mut guard = self.stop_tx.lock().await;
            *guard = Some(stop_tx);
        }

        let (url_tx, mut url_rx) = tokio::sync::oneshot::channel::<String>();
        let url_tx = Arc::new(TokioMutex::new(Some(url_tx)));

        // Supervisor task: keeps child running and handles stop or unexpected exit
        let status_arc = self.status.clone();
        let allowed_host_arc = self.allowed_host.clone();
        let app_handle_arc = self.app_handle.clone();

        tokio::spawn(async move {
            tokio::select! {
                _ = &mut stop_rx => {
                    let _ = child.kill().await;
                    let _ = child.wait().await;
                }
                exit_res = child.wait() => {
                    eprintln!("[Nook Tunnel] cloudflared process exited: {:?}", exit_res);

                    if let Ok(mut host_guard) = allowed_host_arc.lock() {
                        *host_guard = None;
                    }

                    {
                        let mut st = status_arc.lock().await;
                        if st.active || st.connecting {
                            st.active = false;
                            st.connecting = false;
                            st.error = Some("O túnel Cloudflare foi encerrado ou perdeu a conexão.".to_string());
                        }
                    }

                    let guard = app_handle_arc.lock().await;
                    if let Some(ref app) = *guard {
                        let st = status_arc.lock().await;
                        let _ = app.emit("mobile-tunnel-status", &*st);
                    }
                }
            }
        });

        // Drain stderr and stdout continuously to capture the tunnel URL and prevent Windows ERROR_BROKEN_PIPE
        Self::spawn_log_monitor(
            stderr,
            self.status.clone(),
            self.allowed_host.clone(),
            self.app_handle.clone(),
            url_tx.clone(),
        );
        Self::spawn_log_monitor(
            stdout,
            self.status.clone(),
            self.allowed_host.clone(),
            self.app_handle.clone(),
            url_tx,
        );

        // Wait up to 25 seconds for tunnel creation
        tokio::select! {
            res = &mut url_rx => {
                match res {
                    Ok(url) => Ok(url),
                    Err(_) => Err("Túnel não retornou endereço antes do encerramento.".to_string()),
                }
            }
            _ = tokio::time::sleep(tokio::time::Duration::from_secs(25)) => {
                let mut st = self.status.lock().await;
                st.connecting = false;
                st.active = false;
                st.error = Some("Tempo limite esgotado ao conectar com a rede Cloudflare.".to_string());
                self.emit_status().await;
                Err("Tempo limite esgotado ao conectar com a rede Cloudflare.".to_string())
            }
        }
    }

    pub async fn stop_tunnel(&self) {
        {
            let mut guard = self.stop_tx.lock().await;
            if let Some(tx) = guard.take() {
                let _ = tx.send(());
            }
        }

        if let Ok(mut host_guard) = self.allowed_host.lock() {
            *host_guard = None;
        }

        {
            let mut st = self.status.lock().await;
            st.active = false;
            st.connecting = false;
            st.url = None;
            st.pair_code = None;
            st.error = None;
        }

        self.emit_status().await;
    }

    pub async fn get_status(&self) -> TunnelStatus {
        let st = self.status.lock().await;
        st.clone()
    }

    pub async fn emit_status(&self) {
        let guard = self.app_handle.lock().await;
        if let Some(ref app) = *guard {
            let st = self.status.lock().await;
            let _ = app.emit("mobile-tunnel-status", &*st);
        }
    }
}
