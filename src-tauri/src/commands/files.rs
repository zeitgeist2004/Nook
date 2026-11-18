use crate::db::DbState;
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use tauri::State;

#[derive(Clone)]
pub struct InitialFileState(pub Arc<Mutex<Option<String>>>);

#[tauri::command]
pub fn get_initial_file(state: State<'_, InitialFileState>) -> Option<String> {
    let mut guard = state.0.lock().ok()?;
    guard.take()
}

#[derive(serde::Serialize)]
pub struct ExternalFileContent {
    pub path: String,
    pub filename: String,
    pub content: String,
}

/// Decode raw file bytes cleanly across UTF-8 (with/without BOM), UTF-16 LE/BE, and Windows-1252 ANSI.
pub fn decode_text_bytes(bytes: &[u8]) -> String {
    if bytes.starts_with(&[0xEF, 0xBB, 0xBF]) {
        return decode_utf8_or_cp1252(&bytes[3..]);
    }
    if bytes.starts_with(&[0xFF, 0xFE]) && bytes.len() >= 2 {
        let u16s: Vec<u16> = bytes[2..]
            .as_chunks::<2>()
            .0
            .iter()
            .map(|&c| u16::from_le_bytes(c))
            .collect();
        return String::from_utf16_lossy(&u16s);
    }
    if bytes.starts_with(&[0xFE, 0xFF]) && bytes.len() >= 2 {
        let u16s: Vec<u16> = bytes[2..]
            .as_chunks::<2>()
            .0
            .iter()
            .map(|&c| u16::from_be_bytes(c))
            .collect();
        return String::from_utf16_lossy(&u16s);
    }
    decode_utf8_or_cp1252(bytes)
}

fn decode_utf8_or_cp1252(bytes: &[u8]) -> String {
    if let Ok(s) = std::str::from_utf8(bytes) {
        return s.to_string();
    }
    // Windows-1252 fallback so legacy ANSI .txt files with accents open accurately
    const CP1252_EXTRA: [char; 32] = [
        '\u{20AC}', '\u{FFFD}', '\u{201A}', '\u{0192}', '\u{201E}', '\u{2026}', '\u{2020}', '\u{2021}',
        '\u{02C6}', '\u{2030}', '\u{0160}', '\u{2039}', '\u{0152}', '\u{FFFD}', '\u{017D}', '\u{FFFD}',
        '\u{FFFD}', '\u{2018}', '\u{2019}', '\u{201C}', '\u{201D}', '\u{2022}', '\u{2013}', '\u{2014}',
        '\u{02DC}', '\u{2122}', '\u{0161}', '\u{203A}', '\u{0153}', '\u{FFFD}', '\u{017E}', '\u{0178}',
    ];
    let mut out = String::with_capacity(bytes.len());
    for &b in bytes {
        if !(0x80..0xA0).contains(&b) {
            out.push(b as char);
        } else {
            out.push(CP1252_EXTRA[(b - 0x80) as usize]);
        }
    }
    out
}

pub fn normalize_external_path(raw: &str) -> String {
    let cleaned = raw.trim().trim_matches('"');
    let path = Path::new(cleaned);
    if path.exists()
        && let Ok(canon) = fs::canonicalize(path)
    {
        let s = canon.to_string_lossy().to_string();
        #[cfg(windows)]
        {
            if let Some(stripped) = s.strip_prefix(r"\\?\UNC\") {
                return format!(r"\\{}", stripped);
            }
            if let Some(stripped) = s.strip_prefix(r"\\?\") {
                return stripped.to_string();
            }
        }
        return s;
    }
    cleaned.to_string()
}

#[tauri::command]
pub fn read_external_file(file_path: String) -> Result<ExternalFileContent, String> {
    let normalized_path = normalize_external_path(&file_path);
    let path = Path::new(&normalized_path);
    if !path.exists() || !path.is_file() {
        return Err(format!("O arquivo não existe: {}", file_path));
    }

    let raw_bytes = fs::read(path).map_err(|e| format!("Falha ao ler arquivo: {}", e))?;
    let content = decode_text_bytes(&raw_bytes);

    let filename = path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("documento.txt")
        .to_string();

    Ok(ExternalFileContent {
        path: normalized_path,
        filename,
        content,
    })
}

#[tauri::command]
pub fn write_external_file(file_path: String, content: String) -> Result<(), String> {
    let cleaned = file_path.trim().trim_matches('"');
    if cleaned.is_empty() {
        return Err("Caminho de arquivo externo inválido.".to_string());
    }
    fs::write(cleaned, content.as_bytes())
        .map_err(|e| format!("Falha ao salvar no arquivo: {}", e))?;
    Ok(())
}

#[tauri::command]
pub fn export_library_to_folder(
    state: State<'_, DbState>,
    destination_folder: String,
) -> Result<usize, String> {
    let dest_path = PathBuf::from(&destination_folder);
    if !dest_path.exists() {
        fs::create_dir_all(&dest_path)
            .map_err(|e| format!("Falha ao criar diretório de destino: {}", e))?;
    }

    // Fetch active language, collections and notes snapshot, then release SQLite lock before disk I/O
    let (lang, coll_map, notes_to_export) = {
        let conn = state.conn.lock().map_err(|e| e.to_string())?;
        let lang = crate::commands::settings::get_active_language(&conn);

        // Load active collections
        let mut stmt = conn
            .prepare("SELECT id, name, parent_id FROM collections WHERE deleted_at IS NULL")
            .map_err(|e| e.to_string())?;
        let coll_rows = stmt
            .query_map([], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, Option<String>>(2)?,
                ))
            })
            .map_err(|e| e.to_string())?;

        let mut coll_map = HashMap::new();
        for r in coll_rows {
            let (id, name, parent_id) = r.map_err(|e| e.to_string())?;
            coll_map.insert(id, (name, parent_id));
        }

        // Load active notes
        let mut note_stmt = conn
            .prepare("SELECT title, content, collection_id FROM notes WHERE deleted_at IS NULL")
            .map_err(|e| e.to_string())?;
        let note_rows = note_stmt
            .query_map([], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, Option<String>>(2)?,
                ))
            })
            .map_err(|e| e.to_string())?;

        let mut notes_list = Vec::new();
        for r in note_rows {
            notes_list.push(r.map_err(|e| e.to_string())?);
        }

        (lang, coll_map, notes_list)
    }; // Mutex lock is explicitly dropped here!

    let quick_notes_folder = crate::commands::settings::pick_lang(
        &lang,
        "Notas Rápidas",
        "Quick Notes",
        "Notas Rápidas",
    );

    // Helper to resolve folder path
    let resolve_folder_path = |coll_id: &Option<String>| -> PathBuf {
        let mut parts = Vec::new();
        let mut cur = coll_id.clone();
        while let Some(cid) = cur {
            if let Some((name, parent)) = coll_map.get(&cid) {
                let clean_name = sanitize_filename(name);
                parts.push(clean_name);
                cur = parent.clone();
            } else {
                break;
            }
        }
        parts.reverse();
        let mut path = dest_path.clone();
        if parts.is_empty() {
            path.push(quick_notes_folder);
        } else {
            for part in parts {
                path.push(part);
            }
        }
        path
    };

    let mut count = 0;
    for (title, content, collection_id) in notes_to_export {
        let target_dir = resolve_folder_path(&collection_id);
        fs::create_dir_all(&target_dir).map_err(|e| e.to_string())?;

        let clean_title = sanitize_filename(&title);
        let filename = if clean_title.is_empty() {
            format!("nota_{}.md", count + 1)
        } else {
            format!("{}.md", clean_title)
        };

        let file_path = target_dir.join(filename);
        fs::write(&file_path, content.as_bytes()).map_err(|e| e.to_string())?;
        count += 1;
    }

    Ok(count)
}

fn sanitize_filename(name: &str) -> String {
    let sanitized: String = name
        .chars()
        .map(|c| match c {
            '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*' => '_',
            _ => c,
        })
        .collect();
    sanitized.trim().to_string()
}
