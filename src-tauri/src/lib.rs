pub mod commands;
pub mod db;
pub mod diff;
pub mod image_cache;
pub mod pdf;
pub mod releases;
pub mod repository;
pub mod watcher;

use std::path::PathBuf;
use std::sync::Mutex;

use db::DbPool;
use watcher::FileWatcher;

pub struct AppState {
    pub db: Mutex<Option<DbPool>>,
    pub repo_path: Mutex<Option<PathBuf>>,
    pub watcher: Mutex<Option<FileWatcher>>,
}

impl AppState {
    pub fn new() -> Self {
        AppState {
            db: Mutex::new(None),
            repo_path: Mutex::new(None),
            watcher: Mutex::new(None),
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
            commands::get_commit_history,
            commands::get_project_commits,
            commands::get_drawings_at_commit,
            commands::get_pdf_image,
            commands::get_working_copy_image,
            commands::generate_diff,
            commands::create_release,
            commands::list_releases,
            commands::get_release_drawings,
            commands::generate_bind_pdf,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|_app_handle, _event| {});
}
