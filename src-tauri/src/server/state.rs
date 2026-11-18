use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tokio::sync::broadcast;
use crate::db::DbState;

#[derive(Clone, Default)]
pub struct AuthManager {
    tokens: Arc<Mutex<HashMap<String, Instant>>>,
}

impl AuthManager {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn create_token(&self) -> String {
        let token = uuid::Uuid::new_v4().to_string();
        let expires_at = Instant::now() + Duration::from_secs(120);
        if let Ok(mut map) = self.tokens.lock() {
            let now = Instant::now();
            map.retain(|_, exp| *exp > now);
            map.insert(token.clone(), expires_at);
        }
        token
    }

    pub fn validate_and_consume(&self, token: &str) -> bool {
        if let Ok(mut map) = self.tokens.lock() {
            let now = Instant::now();
            if let Some(exp) = map.get(token)
                && *exp > now
            {
                // Grace period of 10s for browser pre-fetch / duplicate request
                map.insert(token.to_string(), now + Duration::from_secs(10));
                return true;
            }
        }
        false
    }
}

#[derive(Clone, Debug, serde::Serialize, serde::Deserialize)]
pub struct PendingPairRequest {
    pub request_id: String,
    pub pair_code: String,
    pub device_name: String,
    pub user_agent: String,
    pub ip_hint: Option<String>,
    pub created_at: i64,
    pub approved_session: Option<String>,
    pub is_rejected: bool,
}

#[derive(Clone, Default)]
pub struct MobilePairManager {
    pair_codes: Arc<Mutex<HashMap<String, Instant>>>,
    requests: Arc<Mutex<HashMap<String, PendingPairRequest>>>,
}

impl MobilePairManager {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn create_pair_code(&self) -> String {
        let code = uuid::Uuid::new_v4().to_string().replace("-", "")[..16].to_uppercase();
        let expires_at = Instant::now() + Duration::from_secs(300); // 5 minutes
        if let Ok(mut map) = self.pair_codes.lock() {
            let now = Instant::now();
            map.retain(|_, exp| *exp > now);
            map.insert(code.clone(), expires_at);
        }
        code
    }

    pub fn request_pairing(
        &self,
        pair_code: &str,
        device_name: &str,
        user_agent: &str,
        ip_hint: Option<&str>,
    ) -> Result<String, String> {
        let clean_code = pair_code.trim().to_uppercase();
        let valid = {
            if let Ok(mut map) = self.pair_codes.lock() {
                let now = Instant::now();
                if let Some(exp) = map.remove(&clean_code) {
                    exp > now
                } else {
                    false
                }
            } else {
                false
            }
        };

        if !valid {
            return Err("Código de pareamento inválido ou expirado. Gere um novo QR Code no Nook Desktop.".to_string());
        }

        let request_id = uuid::Uuid::new_v4().to_string();
        let now_ms = chrono::Utc::now().timestamp_millis();
        let req = PendingPairRequest {
            request_id: request_id.clone(),
            pair_code: clean_code,
            device_name: device_name.to_string(),
            user_agent: user_agent.to_string(),
            ip_hint: ip_hint.map(|s| s.to_string()),
            created_at: now_ms,
            approved_session: None,
            is_rejected: false,
        };

        if let Ok(mut reqs) = self.requests.lock() {
            reqs.insert(request_id.clone(), req);
        }

        Ok(request_id)
    }

    pub fn get_pending_requests(&self) -> Vec<PendingPairRequest> {
        if let Ok(reqs) = self.requests.lock() {
            reqs.values()
                .filter(|r| r.approved_session.is_none() && !r.is_rejected)
                .cloned()
                .collect()
        } else {
            Vec::new()
        }
    }

    pub fn approve_pairing(&self, request_id: &str) -> Result<(String, String, String, String), String> {
        if let Ok(mut reqs) = self.requests.lock()
            && let Some(req) = reqs.get_mut(request_id)
        {
            if req.is_rejected {
                return Err("Solicitação já foi rejeitada anteriormente.".to_string());
            }
            let session_token = format!("{}-{}", uuid::Uuid::new_v4(), uuid::Uuid::new_v4());
            let device_id = uuid::Uuid::new_v4().to_string();
            req.approved_session = Some(session_token.clone());

            return Ok((device_id, req.device_name.clone(), req.user_agent.clone(), session_token));
        }
        Err("Solicitação de pareamento não encontrada.".to_string())
    }

    pub fn reject_pairing(&self, request_id: &str) -> Result<(), String> {
        if let Ok(mut reqs) = self.requests.lock()
            && let Some(req) = reqs.get_mut(request_id)
        {
            req.is_rejected = true;
            return Ok(());
        }
        Err("Solicitação de pareamento não encontrada.".to_string())
    }

    pub fn poll_pairing(&self, request_id: &str) -> Result<Option<String>, String> {
        if let Ok(reqs) = self.requests.lock()
            && let Some(req) = reqs.get(request_id)
        {
            if req.is_rejected {
                return Err("Pareamento recusado pelo computador.".to_string());
            }
            if let Some(ref session) = req.approved_session {
                return Ok(Some(session.clone()));
            }
            return Ok(None);
        }
        Err("Solicitação de pareamento expirada ou não encontrada.".to_string())
    }
}

#[derive(Clone)]
pub struct ServerState {
    pub db: DbState,
    pub port: u16,
    pub session_token: String,
    pub auth_manager: AuthManager,
    pub mobile_pair_manager: MobilePairManager,
    pub allowed_tunnel_host: Arc<Mutex<Option<String>>>,
    pub dist_path: PathBuf,
    pub ws_broadcast_tx: broadcast::Sender<String>,
    pub app_handle: Option<tauri::AppHandle>,
}
