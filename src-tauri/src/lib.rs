pub mod commands;
pub mod db;
pub mod server;

use commands::files::InitialFileState;
use commands::web::WebManagerState;
use db::DbState;
use server::TunnelManager;
use std::sync::{Arc, Mutex};
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIcon, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager,
};

pub struct TrayLocalizationState {
    pub open_nook: MenuItem<tauri::Wry>,
    pub open_web: MenuItem<tauri::Wry>,
    pub stop_web: MenuItem<tauri::Wry>,
    pub quit: MenuItem<tauri::Wry>,
    pub tray: TrayIcon<tauri::Wry>,
}

pub fn apply_tray_language(app: &tauri::AppHandle, lang: &str) {
    if let Some(tray_state) = app.try_state::<TrayLocalizationState>() {
        let normalized = commands::settings::normalize_lang(lang);
        let (open_nook, open_web, stop_web, quit, tooltip) = match normalized {
            "en" => (
                "Open Nook",
                "Open in browser",
                "Stop Web access",
                "Quit Nook",
                "Nook — Your notes",
            ),
            "es" => (
                "Abrir Nook",
                "Abrir en el navegador",
                "Detener acceso Web",
                "Salir de Nook",
                "Nook — Tus notas",
            ),
            _ => (
                "Abrir Nook",
                "Abrir no navegador",
                "Encerrar acesso Web",
                "Sair do Nook",
                "Nook — Suas notas",
            ),
        };
        let _ = tray_state.open_nook.set_text(open_nook);
        let _ = tray_state.open_web.set_text(open_web);
        let _ = tray_state.stop_web.set_text(stop_web);
        let _ = tray_state.quit.set_text(quit);
        let _ = tray_state.tray.set_tooltip(Some(tooltip));
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Check CLI arguments for any file passed to open on cold start (e.g. double-clicked in Windows Explorer)
    let mut initial_file: Option<String> = None;
    for arg in std::env::args().skip(1) {
        let cleaned = arg.trim().trim_matches('"');
        if !cleaned.is_empty() && !cleaned.starts_with('-') {
            let normalized = commands::files::normalize_external_path(cleaned);
            let p = std::path::Path::new(&normalized);
            if p.exists() && p.is_file() {
                initial_file = Some(normalized);
                break;
            }
        }
    }
    let initial_file_state = InitialFileState(Arc::new(Mutex::new(initial_file)));
    let initial_file_shared = initial_file_state.0.clone();

    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(move |app, args, cwd| {
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.show();
                let _ = w.unminimize();
                let _ = w.maximize();
                let _ = w.set_focus();

                // Check if a file was passed as argument in this second instance launch
                for arg in args.into_iter().skip(1) {
                    let cleaned = arg.trim().trim_matches('"');
                    if !cleaned.is_empty() && !cleaned.starts_with('-') {
                        let candidate = std::path::Path::new(cleaned);
                        let resolved = if candidate.is_absolute() {
                            cleaned.to_string()
                        } else {
                            std::path::Path::new(&cwd).join(candidate).to_string_lossy().to_string()
                        };
                        let normalized = commands::files::normalize_external_path(&resolved);
                        let p = std::path::Path::new(&normalized);
                        if p.exists() && p.is_file() {
                            let _ = w.emit("nook-open-file", normalized.clone());
                            if let Ok(mut guard) = initial_file_shared.lock() {
                                *guard = Some(normalized);
                            }
                            break;
                        }
                    }
                }
            }
        }))
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(move |app| {
            if cfg!(debug_assertions) {
                let _ = app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                );
            }

            // Ensure main window starts maximized and focused in full screen
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.show();
                let _ = w.unminimize();
                let _ = w.maximize();
                let _ = w.set_focus();
            }

            // Determine app data path for SQLite database
            let app_data_dir = app
                .path()
                .app_local_data_dir()
                .unwrap_or_else(|_| std::env::current_dir().unwrap());
            let db_path = app_data_dir.join("lumina_notes.db");

            let db_state =
                DbState::new(db_path).expect("Failed to initialize Lumina SQLite database");

            let initial_lang = db_state
                .conn
                .lock()
                .map(|c| commands::settings::get_initial_tray_language(&c))
                .unwrap_or_else(|_| "en".to_string());

            app.manage(db_state);
            app.manage(WebManagerState::new());
            app.manage(TunnelManager::new(Arc::new(Mutex::new(None))));
            app.manage(initial_file_state);

            // Build system tray menu
            let open_nook = MenuItem::with_id(app, "open_nook", "Abrir Nook", true, None::<&str>)?;
            let open_web = MenuItem::with_id(app, "open_web", "Abrir no navegador", true, None::<&str>)?;
            let stop_web = MenuItem::with_id(app, "stop_web", "Encerrar acesso Web", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Sair do Nook", true, None::<&str>)?;

            let tray_menu = Menu::with_items(app, &[&open_nook, &open_web, &stop_web, &quit])?;

            let mut tray_builder = TrayIconBuilder::new()
                .menu(&tray_menu)
                .show_menu_on_left_click(false)
                .tooltip("Nook — Suas notas")
                .on_menu_event(|app, event| {
                    match event.id.as_ref() {
                        "open_nook" => {
                            if let Some(w) = app.get_webview_window("main") {
                                let _ = w.show();
                                let _ = w.unminimize();
                                let _ = w.maximize();
                                let _ = w.set_focus();
                            }
                        }
                        "open_web" => {
                            let app_handle = app.clone();
                            tauri::async_runtime::spawn(async move {
                                let db = app_handle.state::<DbState>();
                                let web_state = app_handle.state::<WebManagerState>();
                                let _ = commands::web::open_nook_web(app_handle.clone(), db, web_state).await;
                            });
                        }
                        "stop_web" => {
                            let app_handle = app.clone();
                            tauri::async_runtime::spawn(async move {
                                let web_state = app_handle.state::<WebManagerState>();
                                let _ = commands::web::stop_web_server(app_handle.clone(), web_state).await;
                                if let Some(w) = app_handle.get_webview_window("main") {
                                    let _ = w.show();
                                    let _ = w.unminimize();
                                    let _ = w.maximize();
                                    let _ = w.set_focus();
                                }
                            });
                        }
                        "quit" => {
                            app.exit(0);
                        }
                        _ => {}
                    }
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(w) = app.get_webview_window("main") {
                            let _ = w.show();
                            let _ = w.unminimize();
                            let _ = w.maximize();
                            let _ = w.set_focus();
                        }
                    }
                });

            if let Some(icon) = app.default_window_icon() {
                tray_builder = tray_builder.icon(icon.clone());
            }

            let tray = tray_builder.build(app)?;
            app.manage(TrayLocalizationState {
                open_nook,
                open_web,
                stop_web,
                quit,
                tray,
            });
            apply_tray_language(app.handle(), &initial_lang);

            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                // Minimize to system tray on window close (X)
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .invoke_handler(tauri::generate_handler![
            commands::files::get_initial_file,
            commands::splash::close_splashscreen,
            commands::notes::get_active_notes,
            commands::notes::get_note_by_id,
            commands::notes::create_note,
            commands::notes::save_note,
            commands::notes::update_note_title,
            commands::notes::duplicate_note,
            commands::notes::move_note,
            commands::notes::toggle_pin_note,
            commands::notes::soft_delete_note,
            commands::notes::restore_note,
            commands::notes::permanent_delete_note,
            commands::notes::get_trash_notes,
            commands::notes::empty_trash,
            commands::notes::get_note_versions,
            commands::notes::restore_note_version,
            commands::notes::create_note_version,
            commands::collections::get_collections,
            commands::collections::create_collection,
            commands::collections::update_collection_name,
            commands::collections::move_collection,
            commands::collections::reorder_collections,
            commands::collections::delete_collection,
            commands::collections::restore_collection,
            commands::collections::get_trash_collections,
            commands::search::search_notes,
            commands::files::read_external_file,
            commands::files::write_external_file,
            commands::files::export_library_to_folder,
            commands::backup::get_database_path,
            commands::backup::export_backup_json,
            commands::backup::import_backup_json,
            commands::backup::trigger_auto_backup,
            commands::backup::list_auto_backups,
            commands::backup::get_auto_backups_summary,
            commands::backup::delete_auto_backups,
            commands::backup::get_cache_stats,
            commands::backup::clear_app_cache,
            commands::settings::get_settings,
            commands::settings::save_setting,
            commands::web::get_web_status,
            commands::web::start_web_server,
            commands::web::stop_web_server,
            commands::web::open_nook_web,
            commands::web::open_sponsors_page,
            commands::mobile::start_mobile_access,
            commands::mobile::stop_mobile_access,
            commands::mobile::get_mobile_status,
            commands::mobile::get_mobile_pending_pairings,
            commands::mobile::approve_mobile_pairing,
            commands::mobile::reject_mobile_pairing,
            commands::mobile::get_mobile_devices,
            commands::mobile::revoke_mobile_device,
            commands::mobile::delete_mobile_device,
            commands::workflow::inspect_linked_folder,
            commands::workflow::open_local_folder,
            commands::workflow::reveal_local_file,
            commands::workflow::list_project_instructions,
            commands::workflow::read_project_instruction_file,
            commands::workflow::write_project_instruction_file,
            commands::workflow::list_agent_skills,
            commands::workflow::read_agent_skill_detail,
            commands::workflow::read_skill_reference_file,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
