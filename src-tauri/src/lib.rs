pub mod commands;
pub mod db;
pub mod pdf;
pub mod repository;
pub mod watcher;

use std::path::PathBuf;
use std::sync::Mutex;

use db::DbPool;

pub struct AppState {
    pub db: Mutex<Option<DbPool>>,
    pub repo_path: Mutex<Option<PathBuf>>,
}

impl AppState {
    pub fn new() -> Self {
        AppState {
            db: Mutex::new(None),
            repo_path: Mutex::new(None),
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(AppState::new())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            commands::is_initialized,
            commands::init_working_folder,
            commands::get_drawings,
            commands::get_pending_changes,
            commands::commit_changes,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
