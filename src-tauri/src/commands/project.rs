use std::path::Path;

use tauri::State;

use crate::{db::DbPool, repository, watcher::FileWatcher, AppState};

use super::{scan_pdfs, velgit_db_path};

#[tauri::command]
pub fn is_initialized(path: String) -> bool {
    velgit_db_path(Path::new(&path)).exists()
}

#[tauri::command]
pub async fn init_working_folder(
    path: String,
    state: State<'_, AppState>,
    app_handle: tauri::AppHandle,
) -> Result<(), String> {
    let path = Path::new(&path);
    repository::init(path).map_err(|e| format!("{:?}", e))?;

    let db_path = path.join(".git").join("velgit").join("velgit.db");
    let pool = DbPool::open(&db_path).await.map_err(|e| e.to_string())?;

    let pdfs = scan_pdfs(path);
    pool.insert_drawings(&pdfs)
        .await
        .map_err(|e| e.to_string())?;

    let fw = FileWatcher::new(path, app_handle);

    *state.repo_path.lock().unwrap() = Some(path.to_path_buf());
    *state.db.lock().unwrap() = Some(pool);
    *state.watcher.lock().unwrap() = Some(fw);

    Ok(())
}
