use axum::http::{HeaderMap, StatusCode};
use rusqlite::Connection;
use crate::db::queries::DbQueries;

fn is_trycloudflare_host(host: &str) -> bool {
    let clean = host.trim().to_ascii_lowercase();
    clean.len() > ".trycloudflare.com".len()
        && clean.ends_with(".trycloudflare.com")
        && !clean.contains('/')
}

fn extract_origin_host(origin: &str) -> Option<&str> {
    let rest = origin
        .strip_prefix("https://")
        .or_else(|| origin.strip_prefix("http://"))?;
    let host_port = rest.split('/').next()?;
    let host = host_port.split(':').next()?.trim();
    if host.is_empty() { None } else { Some(host) }
}

pub fn validate_host(headers: &HeaderMap, expected_port: u16) -> Result<(), StatusCode> {
    let host = headers
        .get("host")
        .and_then(|h| h.to_str().ok())
        .ok_or(StatusCode::BAD_REQUEST)?;

    let clean_host = host.split(':').next().unwrap_or("").trim().to_lowercase();
    let port_part = host.split(':').nth(1);

    // 1. Allow local loopback
    let is_valid_ip = clean_host == "127.0.0.1" || clean_host == "localhost";
    let is_valid_port = match port_part {
        Some(p) => p == expected_port.to_string(),
        None => true,
    };

    if is_valid_ip && is_valid_port {
        return Ok(());
    }

    // 2. Allow Cloudflare Tunnel domains (strict subdomain match, no arbitrary substring)
    if is_trycloudflare_host(&clean_host) {
        return Ok(());
    }

    Err(StatusCode::FORBIDDEN)
}

pub fn validate_origin(headers: &HeaderMap, expected_port: u16) -> Result<(), StatusCode> {
    if let Some(origin) = headers.get("origin").and_then(|o| o.to_str().ok()) {
        let expected_1 = format!("http://127.0.0.1:{}", expected_port);
        let expected_2 = format!("http://localhost:{}", expected_port);
        if origin == expected_1 || origin == expected_2 {
            return Ok(());
        }

        if let Some(origin_host) = extract_origin_host(origin)
            && is_trycloudflare_host(origin_host)
        {
            return Ok(());
        }

        Err(StatusCode::FORBIDDEN)
    } else {
        // Direct browser navigation or non-CORS request
        Ok(())
    }
}

pub fn extract_session_token(headers: &HeaderMap) -> Option<String> {
    // 1. Check custom X-Nook-Session header
    if let Some(token) = headers.get("x-nook-session").and_then(|v| v.to_str().ok()) {
        let t = token.trim();
        if !t.is_empty() {
            return Some(t.to_string());
        }
    }

    // 2. Check HttpOnly Cookie header (nook_session or nook_mobile_session)
    if let Some(cookie_str) = headers.get("cookie").and_then(|v| v.to_str().ok()) {
        for pair in cookie_str.split(';') {
            let mut parts = pair.trim().splitn(2, '=');
            if let (Some(name), Some(val)) = (parts.next(), parts.next()) {
                let n = name.trim();
                if n == "nook_session" || n == "nook_mobile_session" {
                    let v = val.trim();
                    if !v.is_empty() {
                        return Some(v.to_string());
                    }
                }
            }
        }
    }

    None
}

pub fn validate_session(headers: &HeaderMap, expected_token: &str) -> Result<(), StatusCode> {
    if let Some(token) = extract_session_token(headers)
        && token == expected_token
    {
        return Ok(());
    }
    Err(StatusCode::UNAUTHORIZED)
}

pub fn validate_session_with_db(
    headers: &HeaderMap,
    expected_token: &str,
    db_conn: &Connection,
) -> Result<(), StatusCode> {
    if let Some(token) = extract_session_token(headers) {
        if token == expected_token {
            return Ok(());
        }
        if let Ok(Some(_dev)) = DbQueries::validate_and_touch_device(db_conn, &token) {
            return Ok(());
        }
    }
    Err(StatusCode::UNAUTHORIZED)
}
