pub mod models;
pub mod queries;
pub mod schema;

use rusqlite::Connection;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

#[derive(Clone)]
pub struct DbState {
    pub conn: Arc<Mutex<Connection>>,
    pub db_path: PathBuf,
}

impl DbState {
    pub fn new(db_path: PathBuf) -> Result<Self, Box<dyn std::error::Error>> {
        if let Some(parent) = db_path.parent() {
            std::fs::create_dir_all(parent)?;
        }

        let had_existing_db = db_path.exists()
            && std::fs::metadata(&db_path)
                .map(|m| m.len() > 0)
                .unwrap_or(false);

        let conn = Connection::open(&db_path)?;

        if had_existing_db {
            // Verify existing database before running any schema upgrade so we never silently
            // replace or initialize an empty library if the database is inaccessible/corrupt.
            let integrity: String = conn.query_row("PRAGMA quick_check(1)", [], |r| r.get(0))?;
            if integrity != "ok" {
                return Err(format!("Database integrity check failed: {}", integrity).into());
            }

            let existing_version = schema::get_schema_version(&conn);
            if existing_version < schema::CURRENT_SCHEMA_VERSION
                && let Some(parent) = db_path.parent()
            {
                let ts = chrono::Utc::now().format("%Y%m%d_%H%M%S");
                let pre_migration_path = parent
                    .join("backups")
                    .join(format!("nook_pre_migration_v{}_{}.db", existing_version, ts));
                let _ = schema::backup_sqlite_to_file(&conn, &pre_migration_path);
            }
        }

        schema::init_db(&conn)?;

        Ok(Self {
            conn: Arc::new(Mutex::new(conn)),
            db_path,
        })
    }
}
