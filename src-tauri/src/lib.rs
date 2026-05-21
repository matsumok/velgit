pub mod commands;
pub mod db;
pub mod pdf;
pub mod repository;
pub mod watcher;

use std::path::PathBuf;
use std::sync::Mutex;

use db::DbPool;

pub struct AppState {
    pub db: DbPool,
    pub watched_paths: Mutex<Vec<PathBuf>>,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![commands::get_drawings])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
