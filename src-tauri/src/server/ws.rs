use axum::extract::ws::{Message, WebSocket, WebSocketUpgrade};
use axum::extract::State;
use axum::http::{HeaderMap, StatusCode};
use axum::response::IntoResponse;
use futures_util::StreamExt;
use crate::server::security::{validate_host, validate_origin, validate_session_with_db};
use crate::server::state::ServerState;

pub async fn ws_handler(
    ws: WebSocketUpgrade,
    headers: HeaderMap,
    State(state): State<ServerState>,
) -> Result<impl IntoResponse, StatusCode> {
    validate_host(&headers, state.port)?;
    validate_origin(&headers, state.port)?;
    {
        let conn = state.db.conn.lock().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
        validate_session_with_db(&headers, &state.session_token, &conn)?;
    }

    Ok(ws.on_upgrade(move |socket| handle_socket(socket, state)))
}

async fn handle_socket(mut socket: WebSocket, state: ServerState) {
    let mut rx = state.ws_broadcast_tx.subscribe();

    // Send connection ack immediately upon successful handshake
    let ack = serde_json::json!({
        "type": "connection.ack",
        "app": "Nook",
        "version": "1.0.0"
    });
    if socket.send(Message::Text(ack.to_string().into())).await.is_err() {
        return;
    }

    loop {
        tokio::select! {
            // Forward broadcast events to this web client
            Ok(msg) = rx.recv() => {
                if socket.send(Message::Text(msg.into())).await.is_err() {
                    break;
                }
            }
            // Read client frames (e.g. ping or client-initiated broadcasts)
            Some(Ok(msg)) = socket.next() => {
                match msg {
                    Message::Text(text) => {
                        if let Ok(val) = serde_json::from_str::<serde_json::Value>(&text)
                            && val.get("type").and_then(|t| t.as_str()) == Some("ping")
                        {
                            let pong = serde_json::json!({ "type": "pong" });
                            let _ = socket.send(Message::Text(pong.to_string().into())).await;
                        }
                    }
                    Message::Ping(p) => {
                        let _ = socket.send(Message::Pong(p)).await;
                    }
                    Message::Close(_) => {
                        break;
                    }
                    _ => {}
                }
            }
            else => break,
        }
    }
}
