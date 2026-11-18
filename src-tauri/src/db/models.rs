use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Collection {
    pub id: String,
    pub name: String,
    pub collection_type: String, // 'project' | 'folder'
    pub parent_id: Option<String>,
    pub sort_order: i64,
    pub created_at: i64,
    pub updated_at: i64,
    pub deleted_at: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Note {
    pub id: String,
    pub collection_id: Option<String>,
    pub title: String,
    pub content: String,
    pub is_pinned: bool,
    pub sort_order: i64,
    pub created_at: i64,
    pub updated_at: i64,
    pub deleted_at: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NoteSummary {
    pub id: String,
    pub collection_id: Option<String>,
    pub title: String,
    pub snippet: String,
    pub is_pinned: bool,
    pub sort_order: i64,
    pub created_at: i64,
    pub updated_at: i64,
    pub deleted_at: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResultItem {
    pub id: String,
    pub item_type: String, // 'note' | 'collection'
    pub title: String,
    pub snippet: Option<String>,
    pub collection_id: Option<String>,
    pub collection_name: Option<String>,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SettingItem {
    pub key: String,
    pub value: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NoteVersion {
    pub id: String,
    pub note_id: String,
    pub title: String,
    pub content: String,
    pub created_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AutoBackupInfo {
    pub filename: String,
    pub path: String,
    pub size_bytes: u64,
    pub created_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SaveNoteResponse {
    pub success: bool,
    pub id: String,
    pub version: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthorizedDevice {
    pub id: String,
    pub name: String,
    pub user_agent: String,
    pub token_hash: String,
    pub ip_hint: Option<String>,
    pub created_at: i64,
    pub last_active_at: i64,
    pub is_revoked: bool,
}
