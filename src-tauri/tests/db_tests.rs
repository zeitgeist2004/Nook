use app_lib::db::models::*;
use app_lib::db::queries::DbQueries;
use app_lib::db::schema;
use rusqlite::Connection;

fn setup_db() -> Connection {
    let conn = Connection::open_in_memory().unwrap();
    schema::init_db(&conn).unwrap();
    conn
}

#[test]
fn test_note_lifecycle() {
    let conn = setup_db();

    // 1. Create a note
    let note = DbQueries::create_note(
        &conn,
        None,
        Some("Minha Primeira Nota".into()),
        Some("Olá mundo!".into()),
    )
    .unwrap();
    assert_eq!(note.title, "Minha Primeira Nota");
    assert_eq!(note.content, "Olá mundo!");
    assert_eq!(note.collection_id, None);

    // 2. Auto-save content
    let ts = DbQueries::save_note_content(
        &conn,
        &note.id,
        "Título Editado",
        "Novo conteúdo persistido com sucesso!",
    )
    .unwrap();
    assert!(ts > 0);

    let retrieved = DbQueries::get_note_by_id(&conn, &note.id).unwrap().unwrap();
    assert_eq!(retrieved.title, "Título Editado");
    assert_eq!(retrieved.content, "Novo conteúdo persistido com sucesso!");

    // 3. Pin note
    let is_pinned = DbQueries::toggle_pin_note(&conn, &note.id).unwrap();
    assert!(is_pinned);

    // 4. Duplicate note
    let duplicated = DbQueries::duplicate_note(&conn, &note.id).unwrap().unwrap();
    assert_eq!(duplicated.title, "Título Editado (cópia)");
    assert_eq!(duplicated.content, "Novo conteúdo persistido com sucesso!");

    // 5. Soft-delete to trash
    DbQueries::soft_delete_note(&conn, &note.id).unwrap();
    let active = DbQueries::list_active_notes(&conn).unwrap();
    assert_eq!(active.len(), 1);

    let trash = DbQueries::list_trash_notes(&conn).unwrap();
    assert_eq!(trash.len(), 1);
    assert_eq!(trash[0].id, note.id);

    // 6. Restore from trash
    DbQueries::restore_note(&conn, &note.id).unwrap();
    let active_after_restore = DbQueries::list_active_notes(&conn).unwrap();
    assert_eq!(active_after_restore.len(), 2);
}

#[test]
fn test_collection_hierarchy_and_cycle_prevention() {
    let conn = setup_db();

    // Create Project A
    let proj_a = DbQueries::create_collection(&conn, "Projeto Alfa", "project", None).unwrap();
    assert_eq!(proj_a.name, "Projeto Alfa");
    assert_eq!(proj_a.collection_type, "project");

    // Create Folder B inside Project A
    let folder_b =
        DbQueries::create_collection(&conn, "Pasta Backend", "folder", Some(proj_a.id.clone()))
            .unwrap();
    assert_eq!(folder_b.parent_id, Some(proj_a.id.clone()));

    // Create Subfolder C inside Folder B
    let subfolder_c =
        DbQueries::create_collection(&conn, "Subpasta C", "folder", Some(folder_b.id.clone()))
            .unwrap();

    // Create Note inside Subfolder C
    let note = DbQueries::create_note(
        &conn,
        Some(subfolder_c.id.clone()),
        Some("Nota C".into()),
        Some("Doc".into()),
    )
    .unwrap();
    assert_eq!(note.collection_id, Some(subfolder_c.id.clone()));

    // Attempt Cycle: Try moving Project A into Subfolder C -> Must FAIL!
    let cycle_res = DbQueries::move_collection(&conn, &proj_a.id, Some(subfolder_c.id.clone()));
    assert!(
        cycle_res.is_err(),
        "Moving parent into descendant must return an error!"
    );

    // Attempt Self-nesting: Try moving Folder B into itself -> Must FAIL!
    let self_res = DbQueries::move_collection(&conn, &folder_b.id, Some(folder_b.id.clone()));
    assert!(
        self_res.is_err(),
        "Moving folder into itself must return an error!"
    );

    // Move note from Subfolder C to Project A
    DbQueries::move_note(&conn, &note.id, Some(proj_a.id.clone())).unwrap();
    let updated_note = DbQueries::get_note_by_id(&conn, &note.id).unwrap().unwrap();
    assert_eq!(updated_note.collection_id, Some(proj_a.id.clone()));
}

#[test]
fn test_search_notes_and_collections() {
    let conn = setup_db();

    let _proj =
        DbQueries::create_collection(&conn, "Arquitetura e Design", "project", None).unwrap();
    let _note1 = DbQueries::create_note(
        &conn,
        None,
        Some("Reunião Diária".into()),
        Some("Discutir persistência SQLite e performance".into()),
    )
    .unwrap();
    let _note2 = DbQueries::create_note(
        &conn,
        None,
        Some("Receita de Bolo".into()),
        Some("Farinha, açúcar e chocolate".into()),
    )
    .unwrap();

    // Search for 'SQLite'
    let results = DbQueries::search(&conn, "SQLite").unwrap();
    assert!(!results.is_empty());
    assert_eq!(results[0].title, "Reunião Diária");

    // Search for 'Arquitetura'
    let results_coll = DbQueries::search(&conn, "Arquitetura").unwrap();
    assert!(!results_coll.is_empty());
    assert_eq!(results_coll[0].item_type, "collection");
    assert_eq!(results_coll[0].title, "Arquitetura e Design");
}
