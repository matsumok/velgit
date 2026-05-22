pub mod commands;
pub mod db;
pub mod pdf;
pub mod repository;
pub mod watcher;

use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Mutex;

use db::DbPool;
use watcher::FileWatcher;

pub struct AppState {
    pub db: Mutex<Option<DbPool>>,
    pub repo_path: Mutex<Option<PathBuf>>,
    pub watcher: Mutex<Option<FileWatcher>>,
    pub temp_images: Mutex<HashMap<String, PathBuf>>,
}

impl AppState {
    pub fn new() -> Self {
        AppState {
            db: Mutex::new(None),
            repo_path: Mutex::new(None),
            watcher: Mutex::new(None),
            temp_images: Mutex::new(HashMap::new()),
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(AppState::new())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .register_uri_scheme_protocol("velgit", |ctx, request| {
            use tauri::Manager;
            let state = ctx.app_handle().state::<AppState>();
            let url = request.uri().to_string();
            let id = url
                .strip_prefix("velgit://image/")
                .unwrap_or_default()
                .trim_end_matches('/');
            let map = state.temp_images.lock().unwrap();
            if let Some(path) = map.get(id) {
                if let Ok(bytes) = std::fs::read(path) {
                    return tauri::http::Response::builder()
                        .header("Content-Type", "image/png")
                        .body(bytes)
                        .unwrap();
                }
            }
            tauri::http::Response::builder()
                .status(404)
                .body(vec![])
                .unwrap()
        })
        .invoke_handler(tauri::generate_handler![
            commands::is_initialized,
            commands::init_working_folder,
            commands::get_drawings,
            commands::get_pending_changes,
            commands::commit_changes,
            commands::get_commit_history,
            commands::get_pdf_image,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
