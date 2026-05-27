use tauri::State;

use crate::{
    db::DbPool,
    repository::{self, ChangeKind},
    AppState,
};

use super::{get_pool_opt, require_repo_path, scan_pdfs, DrawingDto, PendingChangeDto};

#[tauri::command]
pub fn get_drawings(state: State<'_, AppState>) -> Result<Vec<DrawingDto>, String> {
    let Ok(path) = require_repo_path(&state) else {
        return Ok(vec![]);
    };
    let filenames = scan_pdfs(&path);
    Ok(filenames
        .into_iter()
        .map(|filename| DrawingDto { filename, added_at: 0 })
        .collect())
}

#[tauri::command]
pub async fn get_changes_at_commit(
    oid: String,
    state: State<'_, AppState>,
) -> Result<Vec<PendingChangeDto>, String> {
    let Ok(path) = require_repo_path(&state) else {
        return Ok(vec![]);
    };
    let changes = repository::changes_at_commit(&path, &oid).map_err(|e| e.to_string())?;

    let pool = get_pool_opt(&state);
    let change_type_map = if let Some(ref pool) = pool {
        DbPool(pool.clone())
            .get_change_types_for_commit(&oid)
            .await
            .unwrap_or_default()
    } else {
        std::collections::HashMap::new()
    };

    Ok(changes
        .into_iter()
        .map(|c| {
            let change_type = change_type_map
                .get(&c.filename)
                .cloned()
                .unwrap_or_else(|| "none".to_string());
            PendingChangeDto {
                filename: c.filename,
                status: match c.status {
                    ChangeKind::New => "new".to_string(),
                    ChangeKind::Modified => "modified".to_string(),
                    ChangeKind::Deleted => "deleted".to_string(),
                },
                change_type,
            }
        })
        .collect())
}

#[tauri::command]
pub fn get_drawings_at_commit(
    oid: String,
    state: State<'_, AppState>,
) -> Result<Vec<String>, String> {
    let Ok(path) = require_repo_path(&state) else {
        return Ok(vec![]);
    };
    repository::drawings_at_commit(&path, &oid).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_pending_changes(
    state: State<'_, AppState>,
) -> Result<Vec<PendingChangeDto>, String> {
    let Ok(path) = require_repo_path(&state) else {
        return Ok(vec![]);
    };
    repository::pending_changes(&path)
        .map_err(|e| e.to_string())
        .map(|changes| {
            changes
                .into_iter()
                .map(|c| {
                    let change_type = match repository::classify_change(
                        &path,
                        &c.filename,
                        &c.status,
                    ) {
                        repository::ChangeType::None => "none",
                        repository::ChangeType::Minor => "minor",
                        repository::ChangeType::Meaningful => "meaningful",
                    }
                    .to_string();
                    PendingChangeDto {
                        filename: c.filename,
                        status: match c.status {
                            ChangeKind::New => "new".to_string(),
                            ChangeKind::Modified => "modified".to_string(),
                            ChangeKind::Deleted => "deleted".to_string(),
                        },
                        change_type,
                    }
                })
                .collect()
        })
}
