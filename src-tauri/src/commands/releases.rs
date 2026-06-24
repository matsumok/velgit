use tauri::State;

use crate::{pdf, releases, repository, AppState};

use super::{require_pool, require_repo_path, ReleaseEntryDto};

#[tauri::command]
pub async fn create_release(
    name: String,
    kind: String,
    recipient: Option<String>,
    drawing_filenames: Vec<String>,
    created_by: String,
    state: State<'_, AppState>,
) -> Result<i64, String> {
    let path = require_repo_path(&state)?;
    let repo = git2::Repository::open(&path).map_err(|e| e.to_string())?;
    let head_oid = repo
        .head()
        .and_then(|h| h.peel_to_commit())
        .map(|c| c.id().to_string())
        .map_err(|e| e.to_string())?;

    let pool = require_pool(&state)?;

    releases::create(
        &pool,
        &name,
        &kind,
        recipient.as_deref(),
        &drawing_filenames,
        &head_oid,
        &created_by,
    )
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn list_releases(
    state: State<'_, AppState>,
) -> Result<Vec<ReleaseEntryDto>, String> {
    let Ok(pool) = require_pool(&state) else {
        return Ok(vec![]);
    };
    releases::list(&pool)
        .await
        .map_err(|e| e.to_string())
        .map(|entries| {
            entries
                .into_iter()
                .map(|e| ReleaseEntryDto {
                    id: e.id,
                    name: e.name,
                    kind: e.kind,
                    recipient: e.recipient,
                    commit_oid: e.commit_oid,
                    created_at: e.created_at,
                    created_by: e.created_by,
                    drawing_count: e.drawing_count,
                })
                .collect()
        })
}

#[tauri::command]
pub async fn get_release_drawings(
    release_id: i64,
    state: State<'_, AppState>,
) -> Result<Vec<String>, String> {
    let Ok(pool) = require_pool(&state) else {
        return Ok(vec![]);
    };
    releases::get_drawings(&pool, release_id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn generate_bind_pdf(
    release_id: i64,
    save_path: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let path = require_repo_path(&state)?;
    let pool = require_pool(&state)?;

    let release = releases::get_by_id(&pool, release_id)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| format!("リリース {release_id} が見つかりません"))?;

    let mut filenames = releases::get_drawings(&pool, release_id)
        .await
        .map_err(|e| e.to_string())?;
    filenames.sort();

    let repo = git2::Repository::open(&path).map_err(|e| e.to_string())?;
    let bound = pdf::bind_from_commit(&repo, &release.commit_oid, &filenames)?;
    std::fs::write(&save_path, &bound).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn generate_commit_bind_pdf(
    commit_oid: String,
    save_path: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let path = require_repo_path(&state)?;

    let mut filenames = repository::drawings_at_commit(&path, &commit_oid)
        .map_err(|e| e.to_string())?;
    filenames.sort();

    let repo = git2::Repository::open(&path).map_err(|e| e.to_string())?;
    let bound = pdf::bind_from_commit(&repo, &commit_oid, &filenames)?;
    std::fs::write(&save_path, &bound).map_err(|e| e.to_string())?;
    Ok(())
}
