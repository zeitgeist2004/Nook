use axum::extract::{Path, Query, State};
use axum::http::{HeaderMap, StatusCode};
use axum::response::{Html, IntoResponse, Redirect, Response};
use axum::Json;
use serde::{Deserialize, Serialize};

use crate::db::models::{Collection, Note, NoteSummary, NoteVersion, SaveNoteResponse, SearchResultItem, SettingItem};
use crate::db::queries::DbQueries;
use crate::server::security::{extract_session_token, validate_host, validate_origin, validate_session_with_db};
use crate::server::state::ServerState;
use tauri::{Emitter, Manager};

pub fn check_auth(headers: &HeaderMap, state: &ServerState) -> Result<(), StatusCode> {
    if let Ok(conn) = state.db.conn.lock() {
        validate_session_with_db(headers, &state.session_token, &conn)
    } else {
        Err(StatusCode::INTERNAL_SERVER_ERROR)
    }
}

fn broadcast_event(state: &ServerState, event_type: &str, payload: serde_json::Value) {
    let msg = serde_json::json!({
        "event": event_type,
        "type": event_type,
        "data": &payload,
        "payload": &payload,
        "origin": "web",
        "timestamp": chrono::Utc::now().timestamp_millis(),
    });
    let _ = state.ws_broadcast_tx.send(msg.to_string());

    if let Some(ref app) = state.app_handle {
        let _ = app.emit("nook-sync", &msg);
    }
}

// ----------------------------------------------------------------------------
// AUTH VERIFICATION (One-Time Token -> HttpOnly Session Cookie -> Redirect /)
// ----------------------------------------------------------------------------
#[derive(Deserialize)]
pub struct VerifyQuery {
    pub token: Option<String>,
}

pub async fn auth_verify(
    Query(q): Query<VerifyQuery>,
    headers: HeaderMap,
    State(state): State<ServerState>,
) -> Response {
    let lang = state
        .db
        .conn
        .lock()
        .ok()
        .map(|c| crate::commands::settings::get_active_language(&c))
        .unwrap_or_else(|| "pt".to_string());

    if validate_host(&headers, state.port).is_err() {
        let invalid_host = crate::commands::settings::pick_lang(
            &lang,
            "<h1>Host inválido</h1>",
            "<h1>Invalid host</h1>",
            "<h1>Host inválido</h1>",
        );
        return (StatusCode::FORBIDDEN, Html(invalid_host)).into_response();
    }

    // 1. If user already has an active, valid session cookie, redirect immediately to root
    if let Some(existing_token) = extract_session_token(&headers)
        && existing_token == state.session_token
    {
        return Redirect::to("/").into_response();
    }

    // 2. Validate one-time token from URL using thread-safe AuthManager
    if let Some(token) = q.token
        && state.auth_manager.validate_and_consume(&token)
    {
        let cookie_header = format!(
            "nook_session={}; HttpOnly; SameSite=Strict; Path=/; Max-Age=2592000",
            state.session_token
        );

        // HTTP 303 Redirect to root (strips token from URL and browser history)
        let mut response = Redirect::to("/").into_response();
        if let Ok(cookie_val) = cookie_header.parse() {
            response.headers_mut().insert(axum::http::header::SET_COOKIE, cookie_val);
        }
        return response;
    }

    // 3. Fallback: Invalid or expired token (monochrome Nook branding)
    let (html_lang, page_title, heading, body1, body2, hint) = match crate::commands::settings::normalize_lang(&lang) {
        "en" => (
            "en",
            "Nook Web — Authorization",
            "Session Expired or Unauthorized",
            "Authorization token is invalid or has already been used. Please reopen from Nook Desktop.",
            "To open Nook Web, open the Nook app on your computer and click the <strong>\"Web\"</strong> button in the header.",
            "Nook • 100% Offline &amp; Private",
        ),
        "es" => (
            "es",
            "Nook Web — Autorización",
            "Sesión Expirada o No Autorizada",
            "El token de autorización es inválido o ya fue utilizado. Por favor, vuelve a abrirlo desde Nook Desktop.",
            "Para abrir Nook Web, abre la app de Nook en tu equipo y haz clic en el botón <strong>\"Web\"</strong> en el encabezado.",
            "Nook • 100% Sin conexión y Privado",
        ),
        _ => (
            "pt-BR",
            "Nook Web — Autorização",
            "Sessão Expirada ou Não Autorizada",
            "Token de autorização inválido ou já utilizado. Por favor, reabra pelo Nook Desktop.",
            "Para abrir o Nook Web, abra o aplicativo Nook no computador e clique no botão <strong>\"Web\"</strong> no cabeçalho.",
            "Nook • 100% Offline e Privado",
        ),
    };

    let error_html = format!(
        r#"<!DOCTYPE html>
<html lang="{html_lang}">
<head>
  <meta charset="UTF-8">
  <title>{page_title}</title>
  <style>
    body {{ background-color: #0D0E11; color: #ECEAE5; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; user-select: none; }}
    .card {{ background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 12px; padding: 36px 32px; max-width: 440px; text-align: center; }}
    h2 {{ font-size: 18px; margin-bottom: 12px; color: #FFFFFF; font-weight: 600; }}
    p {{ font-size: 13px; line-height: 1.6; color: #8E929E; margin-bottom: 16px; }}
    .hint {{ font-size: 11px; color: #5B5F6C; margin-top: 16px; }}
  </style>
</head>
<body>
  <div class="card">
    <h2>{heading}</h2>
    <p>{body1}</p>
    <p style="color: #FFFFFF; font-size: 12px; font-weight: 500;">{body2}</p>
    <div class="hint">{hint}</div>
  </div>
</body>
</html>"#
    );

    (StatusCode::FORBIDDEN, Html(error_html)).into_response()
}

// ----------------------------------------------------------------------------
// STATUS
// ----------------------------------------------------------------------------
#[derive(Serialize)]
pub struct StatusResponse {
    pub status: &'static str,
    pub app: &'static str,
    pub version: &'static str,
    pub build_id: &'static str,
    pub port: u16,
    pub desktop_running: bool,
}

pub async fn get_status(
    headers: HeaderMap,
    State(state): State<ServerState>,
) -> Result<Json<StatusResponse>, StatusCode> {
    validate_host(&headers, state.port)?;
    Ok(Json(StatusResponse {
        status: "ok",
        app: "Nook",
        version: env!("CARGO_PKG_VERSION"),
        build_id: env!("CARGO_PKG_VERSION"),
        port: state.port,
        desktop_running: true,
    }))
}

// ----------------------------------------------------------------------------
// RESTORE APP WINDOW (Web -> Desktop unminimize and restore)
// ----------------------------------------------------------------------------
pub async fn restore_app_window(
    headers: HeaderMap,
    State(state): State<ServerState>,
) -> Result<StatusCode, StatusCode> {
    validate_host(&headers, state.port)?;

    if let Some(ref app) = state.app_handle
        && let Some(window) = app.get_webview_window("main")
    {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.maximize();
        let _ = window.set_focus();
        let _ = app.emit("nook-reload", serde_json::json!({ "reason": "restore" }));
        return Ok(StatusCode::OK);
    }
    Ok(StatusCode::OK)
}

// ----------------------------------------------------------------------------
// NOTES API
// ----------------------------------------------------------------------------
pub async fn get_active_notes(
    headers: HeaderMap,
    State(state): State<ServerState>,
) -> Result<Json<Vec<NoteSummary>>, StatusCode> {
    validate_host(&headers, state.port)?;
    check_auth(&headers, &state)?;

    let conn = state.db.conn.lock().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let notes = DbQueries::list_active_notes(&conn).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(notes))
}

pub async fn get_note_by_id(
    Path(id): Path<String>,
    headers: HeaderMap,
    State(state): State<ServerState>,
) -> Result<Json<Option<Note>>, StatusCode> {
    validate_host(&headers, state.port)?;
    check_auth(&headers, &state)?;

    let conn = state.db.conn.lock().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let note = DbQueries::get_note_by_id(&conn, &id).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(note))
}

#[derive(Deserialize)]
pub struct CreateNotePayload {
    pub collection_id: Option<String>,
    pub title: Option<String>,
    pub content: Option<String>,
}

pub async fn create_note(
    headers: HeaderMap,
    State(state): State<ServerState>,
    Json(payload): Json<CreateNotePayload>,
) -> Result<Json<Note>, StatusCode> {
    validate_host(&headers, state.port)?;
    validate_origin(&headers, state.port)?;
    check_auth(&headers, &state)?;

    let conn = state.db.conn.lock().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let note = DbQueries::create_note(&conn, payload.collection_id, payload.title, payload.content)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    broadcast_event(&state, "note.created", serde_json::to_value(&note).unwrap_or_default());

    Ok(Json(note))
}

#[derive(Deserialize)]
pub struct SaveNotePayload {
    pub id: String,
    pub title: String,
    pub content: String,
    pub version: i64,
    #[serde(default)]
    pub base_updated_at: Option<i64>,
}

pub async fn save_note(
    headers: HeaderMap,
    State(state): State<ServerState>,
    Json(payload): Json<SaveNotePayload>,
) -> Result<Json<SaveNoteResponse>, StatusCode> {
    validate_host(&headers, state.port)?;
    validate_origin(&headers, state.port)?;
    check_auth(&headers, &state)?;

    let conn = state.db.conn.lock().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // Concurrency conflict detection:
    // Compare against client's known updated_at watermark (ignoring monotonic save counters 1, 2, 3...)
    const EPOCH_MS_THRESHOLD: i64 = 1_000_000_000_000;
    let watermark = payload.base_updated_at.or(if payload.version >= EPOCH_MS_THRESHOLD {
        Some(payload.version)
    } else {
        None
    });

    if let Some(expected_updated_at) = watermark
        && let Ok(Some(existing)) = DbQueries::get_note_by_id(&conn, &payload.id)
        && existing.updated_at > expected_updated_at
        && existing.content != payload.content
    {
        let lang = crate::commands::settings::get_active_language(&conn);
        let conflict_label = crate::commands::settings::pick_lang(
            &lang,
            "Conflito Sincronizado",
            "Synced Conflict",
            "Conflicto Sincronizado",
        );
        // Automatic safety backup: preserve the conflicting version in version history
        let _ = DbQueries::create_note_version(
            &conn,
            &payload.id,
            &format!("{} ({})", existing.title, conflict_label),
            &existing.content,
        );
    }

    let updated_at = DbQueries::save_note_content(&conn, &payload.id, &payload.title, &payload.content)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let resp = SaveNoteResponse {
        success: true,
        id: payload.id.clone(),
        version: payload.version,
        updated_at,
    };

    broadcast_event(
        &state,
        "note.saved",
        serde_json::json!({
            "id": payload.id,
            "title": payload.title,
            "content": payload.content,
            "version": payload.version,
            "updated_at": updated_at,
        }),
    );

    Ok(Json(resp))
}

#[derive(Serialize, Deserialize)]
pub struct UpdateTitlePayload {
    pub id: String,
    pub title: String,
}

pub async fn update_note_title(
    headers: HeaderMap,
    State(state): State<ServerState>,
    Json(payload): Json<UpdateTitlePayload>,
) -> Result<StatusCode, StatusCode> {
    validate_host(&headers, state.port)?;
    validate_origin(&headers, state.port)?;
    check_auth(&headers, &state)?;

    let conn = state.db.conn.lock().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    DbQueries::update_note_title(&conn, &payload.id, &payload.title).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    broadcast_event(&state, "note.title_updated", serde_json::to_value(&payload).unwrap_or_default());

    Ok(StatusCode::OK)
}

#[derive(Serialize, Deserialize)]
pub struct IdPayload {
    pub id: String,
}

pub async fn duplicate_note(
    headers: HeaderMap,
    State(state): State<ServerState>,
    Json(payload): Json<IdPayload>,
) -> Result<Json<Option<Note>>, StatusCode> {
    validate_host(&headers, state.port)?;
    validate_origin(&headers, state.port)?;
    check_auth(&headers, &state)?;

    let conn = state.db.conn.lock().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let note = DbQueries::duplicate_note(&conn, &payload.id).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if let Some(ref n) = note {
        broadcast_event(&state, "note.created", serde_json::to_value(n).unwrap_or_default());
    }

    Ok(Json(note))
}

#[derive(Serialize, Deserialize)]
pub struct MoveNotePayload {
    pub id: String,
    pub target_collection_id: Option<String>,
}

pub async fn move_note(
    headers: HeaderMap,
    State(state): State<ServerState>,
    Json(payload): Json<MoveNotePayload>,
) -> Result<StatusCode, StatusCode> {
    validate_host(&headers, state.port)?;
    validate_origin(&headers, state.port)?;
    check_auth(&headers, &state)?;

    let conn = state.db.conn.lock().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    DbQueries::move_note(&conn, &payload.id, payload.target_collection_id.clone())
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    broadcast_event(&state, "note.moved", serde_json::to_value(&payload).unwrap_or_default());

    Ok(StatusCode::OK)
}

pub async fn toggle_pin_note(
    headers: HeaderMap,
    State(state): State<ServerState>,
    Json(payload): Json<IdPayload>,
) -> Result<Json<bool>, StatusCode> {
    validate_host(&headers, state.port)?;
    validate_origin(&headers, state.port)?;
    check_auth(&headers, &state)?;

    let conn = state.db.conn.lock().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let is_pinned = DbQueries::toggle_pin_note(&conn, &payload.id).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    broadcast_event(
        &state,
        "note.pin_toggled",
        serde_json::json!({ "id": payload.id, "is_pinned": is_pinned }),
    );

    Ok(Json(is_pinned))
}

pub async fn soft_delete_note(
    Path(id): Path<String>,
    headers: HeaderMap,
    State(state): State<ServerState>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    validate_host(&headers, state.port)?;
    validate_origin(&headers, state.port)?;
    check_auth(&headers, &state)?;

    let conn = state.db.conn.lock().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    DbQueries::soft_delete_note(&conn, &id).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    broadcast_event(&state, "note.deleted", serde_json::json!({ "id": id }));

    Ok(Json(serde_json::json!({ "success": true, "id": id })))
}

pub async fn restore_note(
    Path(id): Path<String>,
    headers: HeaderMap,
    State(state): State<ServerState>,
) -> Result<StatusCode, StatusCode> {
    validate_host(&headers, state.port)?;
    validate_origin(&headers, state.port)?;
    check_auth(&headers, &state)?;

    let conn = state.db.conn.lock().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    DbQueries::restore_note(&conn, &id).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    broadcast_event(&state, "note.restored", serde_json::json!({ "id": id }));

    Ok(StatusCode::OK)
}

pub async fn get_trash_notes(
    headers: HeaderMap,
    State(state): State<ServerState>,
) -> Result<Json<Vec<NoteSummary>>, StatusCode> {
    validate_host(&headers, state.port)?;
    check_auth(&headers, &state)?;

    let conn = state.db.conn.lock().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let notes = DbQueries::list_trash_notes(&conn).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(notes))
}

pub async fn empty_trash(
    headers: HeaderMap,
    State(state): State<ServerState>,
) -> Result<StatusCode, StatusCode> {
    validate_host(&headers, state.port)?;
    validate_origin(&headers, state.port)?;
    check_auth(&headers, &state)?;

    let conn = state.db.conn.lock().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    DbQueries::empty_trash(&conn).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    broadcast_event(&state, "trash.emptied", serde_json::json!({}));

    Ok(StatusCode::OK)
}

// ----------------------------------------------------------------------------
// VERSIONS API
// ----------------------------------------------------------------------------
pub async fn get_note_versions(
    Path(note_id): Path<String>,
    headers: HeaderMap,
    State(state): State<ServerState>,
) -> Result<Json<Vec<NoteVersion>>, StatusCode> {
    validate_host(&headers, state.port)?;
    check_auth(&headers, &state)?;

    let conn = state.db.conn.lock().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let versions = DbQueries::list_note_versions(&conn, &note_id).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(versions))
}

#[derive(Deserialize)]
pub struct CreateVersionPayload {
    pub title: String,
    pub content: String,
}

pub async fn create_note_version(
    Path(note_id): Path<String>,
    headers: HeaderMap,
    State(state): State<ServerState>,
    Json(payload): Json<CreateVersionPayload>,
) -> Result<Json<NoteVersion>, StatusCode> {
    validate_host(&headers, state.port)?;
    validate_origin(&headers, state.port)?;
    check_auth(&headers, &state)?;

    let conn = state.db.conn.lock().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let ver = DbQueries::create_note_version(&conn, &note_id, &payload.title, &payload.content)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(ver))
}

#[derive(Deserialize)]
pub struct RestoreVersionPayload {
    pub version_id: String,
}

pub async fn restore_note_version(
    Path(note_id): Path<String>,
    headers: HeaderMap,
    State(state): State<ServerState>,
    Json(payload): Json<RestoreVersionPayload>,
) -> Result<Json<Option<Note>>, StatusCode> {
    validate_host(&headers, state.port)?;
    validate_origin(&headers, state.port)?;
    check_auth(&headers, &state)?;

    let conn = state.db.conn.lock().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let note = DbQueries::restore_note_version(&conn, &note_id, &payload.version_id)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if let Some(ref n) = note {
        broadcast_event(&state, "note.updated", serde_json::to_value(n).unwrap_or_default());
    }

    Ok(Json(note))
}

// ----------------------------------------------------------------------------
// COLLECTIONS API
// ----------------------------------------------------------------------------
pub async fn get_collections(
    headers: HeaderMap,
    State(state): State<ServerState>,
) -> Result<Json<Vec<Collection>>, StatusCode> {
    validate_host(&headers, state.port)?;
    check_auth(&headers, &state)?;

    let conn = state.db.conn.lock().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let collections = DbQueries::list_active_collections(&conn).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(collections))
}

#[derive(Deserialize)]
pub struct CreateCollectionPayload {
    pub name: String,
    pub collection_type: String,
    pub parent_id: Option<String>,
}

pub async fn create_collection(
    headers: HeaderMap,
    State(state): State<ServerState>,
    Json(payload): Json<CreateCollectionPayload>,
) -> Result<Json<Collection>, StatusCode> {
    validate_host(&headers, state.port)?;
    validate_origin(&headers, state.port)?;
    check_auth(&headers, &state)?;

    let conn = state.db.conn.lock().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let collection = DbQueries::create_collection(&conn, &payload.name, &payload.collection_type, payload.parent_id)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    broadcast_event(&state, "collection.created", serde_json::to_value(&collection).unwrap_or_default());

    Ok(Json(collection))
}

#[derive(Serialize, Deserialize)]
pub struct RenameCollectionPayload {
    pub id: String,
    pub name: String,
}

pub async fn rename_collection(
    headers: HeaderMap,
    State(state): State<ServerState>,
    Json(payload): Json<RenameCollectionPayload>,
) -> Result<StatusCode, StatusCode> {
    validate_host(&headers, state.port)?;
    validate_origin(&headers, state.port)?;
    check_auth(&headers, &state)?;

    let conn = state.db.conn.lock().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    DbQueries::update_collection_name(&conn, &payload.id, &payload.name).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    broadcast_event(&state, "collection.renamed", serde_json::to_value(&payload).unwrap_or_default());

    Ok(StatusCode::OK)
}

#[derive(Serialize, Deserialize)]
pub struct MoveCollectionPayload {
    pub id: String,
    pub target_parent_id: Option<String>,
}

pub async fn move_collection(
    headers: HeaderMap,
    State(state): State<ServerState>,
    Json(payload): Json<MoveCollectionPayload>,
) -> Result<StatusCode, StatusCode> {
    validate_host(&headers, state.port)?;
    validate_origin(&headers, state.port)?;
    check_auth(&headers, &state)?;

    let conn = state.db.conn.lock().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    DbQueries::move_collection(&conn, &payload.id, payload.target_parent_id.clone())
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    broadcast_event(&state, "collection.moved", serde_json::to_value(&payload).unwrap_or_default());

    Ok(StatusCode::OK)
}

#[derive(Serialize, Deserialize)]
pub struct ReorderCollectionsPayload {
    pub ordered_ids: Vec<String>,
}

pub async fn reorder_collections(
    headers: HeaderMap,
    State(state): State<ServerState>,
    Json(payload): Json<ReorderCollectionsPayload>,
) -> Result<StatusCode, StatusCode> {
    validate_host(&headers, state.port)?;
    validate_origin(&headers, state.port)?;
    check_auth(&headers, &state)?;

    let conn = state.db.conn.lock().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    DbQueries::reorder_collections(&conn, &payload.ordered_ids).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    broadcast_event(&state, "collection.reordered", serde_json::to_value(&payload).unwrap_or_default());

    Ok(StatusCode::OK)
}

pub async fn delete_collection(
    Path(id): Path<String>,
    headers: HeaderMap,
    State(state): State<ServerState>,
) -> Result<StatusCode, StatusCode> {
    validate_host(&headers, state.port)?;
    validate_origin(&headers, state.port)?;
    check_auth(&headers, &state)?;

    let conn = state.db.conn.lock().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    DbQueries::soft_delete_collection(&conn, &id).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    broadcast_event(&state, "collection.deleted", serde_json::json!({ "id": id }));

    Ok(StatusCode::OK)
}

pub async fn permanent_delete_note(
    Path(id): Path<String>,
    headers: HeaderMap,
    State(state): State<ServerState>,
) -> Result<StatusCode, StatusCode> {
    validate_host(&headers, state.port)?;
    validate_origin(&headers, state.port)?;
    check_auth(&headers, &state)?;

    let conn = state.db.conn.lock().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    DbQueries::permanent_delete_note(&conn, &id).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    broadcast_event(&state, "note.permanent_deleted", serde_json::json!({ "id": id }));

    Ok(StatusCode::OK)
}

pub async fn restore_collection(
    Path(id): Path<String>,
    headers: HeaderMap,
    State(state): State<ServerState>,
) -> Result<StatusCode, StatusCode> {
    validate_host(&headers, state.port)?;
    validate_origin(&headers, state.port)?;
    check_auth(&headers, &state)?;

    let conn = state.db.conn.lock().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    DbQueries::restore_collection(&conn, &id).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    broadcast_event(&state, "collection.restored", serde_json::json!({ "id": id }));

    Ok(StatusCode::OK)
}

pub async fn get_trash_collections(
    headers: HeaderMap,
    State(state): State<ServerState>,
) -> Result<Json<Vec<Collection>>, StatusCode> {
    validate_host(&headers, state.port)?;
    check_auth(&headers, &state)?;

    let conn = state.db.conn.lock().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let collections = DbQueries::list_trash_collections(&conn).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(collections))
}

// ----------------------------------------------------------------------------
// SEARCH & SETTINGS API
// ----------------------------------------------------------------------------
#[derive(Deserialize)]
pub struct SearchQuery {
    pub q: Option<String>,
}

pub async fn search_notes(
    Query(q): Query<SearchQuery>,
    headers: HeaderMap,
    State(state): State<ServerState>,
) -> Result<Json<Vec<SearchResultItem>>, StatusCode> {
    validate_host(&headers, state.port)?;
    check_auth(&headers, &state)?;

    let query = q.q.unwrap_or_default();
    let conn = state.db.conn.lock().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let results = DbQueries::search(&conn, &query).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(results))
}

pub async fn get_settings(
    headers: HeaderMap,
    State(state): State<ServerState>,
) -> Result<Json<Vec<SettingItem>>, StatusCode> {
    validate_host(&headers, state.port)?;
    check_auth(&headers, &state)?;

    let conn = state.db.conn.lock().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let settings = DbQueries::get_settings(&conn).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(settings))
}

#[derive(Serialize, Deserialize)]
pub struct SettingPayload {
    pub key: String,
    pub value: String,
}

pub async fn save_setting(
    headers: HeaderMap,
    State(state): State<ServerState>,
    Json(payload): Json<SettingPayload>,
) -> Result<StatusCode, StatusCode> {
    validate_host(&headers, state.port)?;
    validate_origin(&headers, state.port)?;
    check_auth(&headers, &state)?;

    {
        let conn = state.db.conn.lock().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
        DbQueries::set_setting(&conn, &payload.key, &payload.value).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    }

    if payload.key == "language"
        && let Some(ref app) = state.app_handle
    {
        crate::apply_tray_language(app, &payload.value);
    }

    broadcast_event(&state, "settings.updated", serde_json::to_value(&payload).unwrap_or_default());

    Ok(StatusCode::OK)
}

// ----------------------------------------------------------------------------
// NOOK MOBILE & PAIRING API
// ----------------------------------------------------------------------------

pub async fn mobile_entry_redirect(
    Query(q): Query<std::collections::HashMap<String, String>>,
    headers: HeaderMap,
    State(state): State<ServerState>,
) -> Response {
    let _ = validate_host(&headers, state.port);
    if let Some(code) = q.get("pair") {
        Redirect::to(&format!("/?mobile=true&pair={}", code)).into_response()
    } else {
        Redirect::to("/?mobile=true").into_response()
    }
}

#[derive(Deserialize)]
pub struct MobilePairReqBody {
    pub pair_code: String,
    pub device_name: String,
    pub user_agent: Option<String>,
}

pub async fn mobile_request_pairing(
    headers: HeaderMap,
    State(state): State<ServerState>,
    Json(payload): Json<MobilePairReqBody>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    validate_host(&headers, state.port)?;
    let ua = payload.user_agent.unwrap_or_else(|| {
        headers.get("user-agent").and_then(|h| h.to_str().ok()).unwrap_or("Dispositivo Móvel").to_string()
    });

    let req_id = state.mobile_pair_manager.request_pairing(&payload.pair_code, &payload.device_name, &ua, None)
        .map_err(|_| StatusCode::BAD_REQUEST)?;

    // Notify desktop app via Tauri event and nook-sync
    if let Some(ref app) = state.app_handle {
        let evt = serde_json::json!({
            "event": "mobile.pair_requested",
            "data": {
                "request_id": &req_id,
                "device_name": &payload.device_name,
                "user_agent": &ua,
                "timestamp": chrono::Utc::now().timestamp_millis(),
            }
        });
        let _ = app.emit("nook-mobile-pair-requested", &evt);
        let _ = app.emit("nook-sync", &evt);
    }

    Ok(Json(serde_json::json!({
        "success": true,
        "request_id": req_id
    })))
}

#[derive(Deserialize)]
pub struct MobilePollQuery {
    pub request_id: String,
}

pub async fn mobile_poll_pairing(
    Query(q): Query<MobilePollQuery>,
    headers: HeaderMap,
    State(state): State<ServerState>,
) -> Response {
    if validate_host(&headers, state.port).is_err() {
        return StatusCode::FORBIDDEN.into_response();
    }

    match state.mobile_pair_manager.poll_pairing(&q.request_id) {
        Ok(Some(session_token)) => {
            let cookie = format!(
                "nook_mobile_session={}; HttpOnly; SameSite=Lax; Path=/; Max-Age=31536000",
                session_token
            );
            let mut resp = Json(serde_json::json!({
                "approved": true,
                "session_token": session_token
            })).into_response();

            if let Ok(c_val) = cookie.parse() {
                resp.headers_mut().insert(axum::http::header::SET_COOKIE, c_val);
            }
            resp
        }
        Ok(None) => {
            Json(serde_json::json!({ "approved": false, "pending": true })).into_response()
        }
        Err(msg) => {
            (StatusCode::FORBIDDEN, Json(serde_json::json!({ "error": msg, "approved": false }))).into_response()
        }
    }
}

pub async fn mobile_get_devices(
    headers: HeaderMap,
    State(state): State<ServerState>,
) -> Result<Json<Vec<serde_json::Value>>, StatusCode> {
    validate_host(&headers, state.port)?;
    check_auth(&headers, &state)?;

    let conn = state.db.conn.lock().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let devices = DbQueries::get_authorized_devices(&conn).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let safe_list: Vec<serde_json::Value> = devices.into_iter().map(|d| {
        serde_json::json!({
            "id": d.id,
            "name": d.name,
            "user_agent": d.user_agent,
            "created_at": d.created_at,
            "last_active_at": d.last_active_at,
            "is_revoked": d.is_revoked
        })
    }).collect();

    Ok(Json(safe_list))
}

pub async fn mobile_revoke_device(
    Path(id): Path<String>,
    headers: HeaderMap,
    State(state): State<ServerState>,
) -> Result<StatusCode, StatusCode> {
    validate_host(&headers, state.port)?;
    validate_origin(&headers, state.port)?;
    check_auth(&headers, &state)?;

    let conn = state.db.conn.lock().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    DbQueries::revoke_authorized_device(&conn, &id).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    broadcast_event(&state, "device.revoked", serde_json::json!({ "id": id }));

    Ok(StatusCode::OK)
}

pub async fn mobile_delete_device(
    Path(id): Path<String>,
    headers: HeaderMap,
    State(state): State<ServerState>,
) -> Result<StatusCode, StatusCode> {
    validate_host(&headers, state.port)?;
    validate_origin(&headers, state.port)?;
    check_auth(&headers, &state)?;

    let conn = state.db.conn.lock().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    DbQueries::delete_authorized_device(&conn, &id).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    broadcast_event(&state, "device.deleted", serde_json::json!({ "id": id }));

    Ok(StatusCode::OK)
}
