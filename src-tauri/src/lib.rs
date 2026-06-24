pub mod commands;
pub mod db;
pub mod diff;
pub mod image_cache;
pub mod pdf;
pub mod png_encode_fast;
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
            commands::project::is_initialized,
            commands::project::init_working_folder,
            commands::drawings::get_drawings,
            commands::drawings::get_pending_changes,
            commands::drawings::get_drawings_at_commit,
            commands::drawings::get_changes_at_commit,
            commands::drawings::get_head_files,
            commands::commits::commit_changes,
            commands::commits::get_commit_history,
            commands::commits::get_project_commits,
            commands::images::get_pdf_image,
            commands::images::get_working_copy_image,
            commands::images::generate_diff,
            commands::releases::create_release,
            commands::releases::list_releases,
            commands::releases::get_release_drawings,
            commands::releases::generate_bind_pdf,
            commands::releases::generate_commit_bind_pdf,
            commands::releases::generate_release_zip,
            commands::releases::generate_commit_zip,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|_app_handle, _event| {});
}
