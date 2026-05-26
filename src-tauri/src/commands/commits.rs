use tauri::State;

use crate::{
    db::{CommitFileRecord, DbPool},
    diff,
    image_cache,
    repository::{self},
    AppState,
};

use super::{get_pool_opt, require_repo_path, CommitEntryDto};

#[tauri::command]
pub async fn commit_changes(
    message: String,
    included_files: Vec<String>,
    created_by: String,
    state: State<'_, AppState>,
    app_handle: tauri::AppHandle,
) -> Result<(), String> {
    let path = require_repo_path(&state)?;

    if included_files.is_empty() {
        return Err("コミット対象のファイルが選択されていません".to_string());
    }

    let pending = repository::pending_changes(&path).map_err(|e| e.to_string())?;
    let pending_map: std::collections::HashMap<_, _> =
        pending.iter().map(|c| (c.filename.as_str(), c)).collect();

    let oid = repository::commit(&path, &message, &created_by, &included_files)
        .map_err(|e| e.to_string())?;
    let oid_str = oid.to_string();

    let pool = get_pool_opt(&state);
    if let Some(pool) = &pool {
        // 初期レコードをバイト比較結果で即時挿入（高速）
        let records: Vec<CommitFileRecord> = included_files
            .iter()
            .filter_map(|filename| {
                let c = pending_map.get(filename.as_str())?;
                let change_type =
                    match repository::classify_change(&path, &c.filename, &c.status) {
                        repository::ChangeType::None => "none",
                        repository::ChangeType::Minor => "minor",
                        repository::ChangeType::Meaningful => "meaningful",
                    }
                    .to_string();
                Some(CommitFileRecord {
                    filename: c.filename.clone(),
                    change_type,
                    overridden: false,
                })
            })
            .collect();
        let db = DbPool(pool.clone());
        db.insert_commit_files(&oid_str, &records)
            .await
            .map_err(|e| e.to_string())?;
    }

    // バックグラウンドで画像キャッシュ生成とビジュアル差分計算を並行実行
    if let Some(pool) = pool {
        let path_bg = path.clone();
        let oid_bg = oid_str.clone();
        let files_bg = included_files.clone();
        let app_handle_bg = app_handle.clone();
        tauri::async_runtime::spawn(async move {
            use tauri::Emitter;
            for filename in &files_bg {
                let filename = filename.clone();
                let path = path_bg.clone();
                let oid_str = oid_bg.clone();

                // git2 は !Send のためブロッキングスレッドで blob データを取得
                let blobs = tokio::task::spawn_blocking({
                    let filename = filename.clone();
                    move || -> Option<(String, Vec<u8>, Option<(String, Vec<u8>)>)> {
                        let repo = git2::Repository::open(&path).ok()?;
                        let oid = git2::Oid::from_str(&oid_str).ok()?;
                        let commit = repo.find_commit(oid).ok()?;
                        let tree = commit.tree().ok()?;
                        let entry = tree.get_name(&filename)?;
                        let blob_oid_new = entry.id().to_string();
                        let pdf_new = repo.find_blob(entry.id()).ok()?.content().to_vec();
                        let old_info = commit.parent(0).ok().and_then(|parent| {
                            let tree = parent.tree().ok()?;
                            let entry = tree.get_name(&filename)?;
                            let blob_oid_old = entry.id().to_string();
                            let pdf_old = repo.find_blob(entry.id()).ok()?.content().to_vec();
                            Some((blob_oid_old, pdf_old))
                        });
                        Some((blob_oid_new, pdf_new, old_info))
                    }
                })
                .await
                .ok()
                .flatten();

                let Some((blob_oid_new, pdf_new, old_info)) = blobs else {
                    eprintln!("[classify] blob extraction failed for {filename}");
                    continue;
                };

                let png_new =
                    image_cache::get_or_rasterize(&pool, &pdf_new, &blob_oid_new, 0)
                        .await
                        .inspect_err(|e| eprintln!("[classify] rasterize new failed for {filename}: {e}"))
                        .ok();

                let png_old = if let Some((blob_oid_old, pdf_old)) = old_info {
                    image_cache::get_or_rasterize(&pool, &pdf_old, &blob_oid_old, 0)
                        .await
                        .inspect_err(|e| eprintln!("[classify] rasterize old failed for {filename}: {e}"))
                        .ok()
                } else {
                    None
                };

                let change_type = match (png_new, png_old) {
                    (Some(pn), Some(po)) => tokio::task::spawn_blocking(move || {
                        let rn = image_cache::decode_to_rgba(&pn).ok()?;
                        let ro = image_cache::decode_to_rgba(&po).ok()?;
                        Some(
                            match diff::diff(&ro, &rn).change_type {
                                diff::ChangeType::None => "none",
                                diff::ChangeType::Minor => "minor",
                                diff::ChangeType::Meaningful => "meaningful",
                            }
                            .to_string(),
                        )
                    })
                    .await
                    .ok()
                    .flatten()
                    .unwrap_or_else(|| "meaningful".to_string()),
                    _ => "meaningful".to_string(),
                };

                let db = DbPool(pool.clone());
                if let Err(e) = db
                    .update_commit_file_change_type(&oid_bg, &filename, &change_type)
                    .await
                {
                    eprintln!("[classify] DB update failed for {filename}: {e}");
                }
            }
            if let Err(e) = app_handle_bg.emit("commit-classified", ()) {
                eprintln!("[classify] emit failed: {e}");
            }
        });
    }

    Ok(())
}

#[tauri::command]
pub async fn get_commit_history(
    filename: String,
    state: State<'_, AppState>,
) -> Result<Vec<CommitEntryDto>, String> {
    let Ok(path) = require_repo_path(&state) else {
        return Ok(vec![]);
    };
    let pool = get_pool_opt(&state);

    let entries =
        repository::commit_history(&path, &filename).map_err(|e| e.to_string())?;

    let change_type_map = if let Some(pool) = pool {
        let oids: Vec<String> = entries.iter().map(|e| e.oid.clone()).collect();
        DbPool(pool)
            .get_change_types_for_file(&oids, &filename)
            .await
            .unwrap_or_default()
    } else {
        std::collections::HashMap::new()
    };

    let dtos = entries
        .into_iter()
        .map(|e| {
            let change_type = change_type_map.get(&e.oid).cloned();
            CommitEntryDto {
                oid: e.oid,
                message: e.message,
                author: e.author,
                timestamp: e.timestamp,
                change_type,
                blob_oid: Some(e.blob_oid),
            }
        })
        .collect();
    Ok(dtos)
}

#[tauri::command]
pub fn get_project_commits(
    state: State<'_, AppState>,
) -> Result<Vec<CommitEntryDto>, String> {
    let Ok(path) = require_repo_path(&state) else {
        return Ok(vec![]);
    };
    repository::project_commits(&path)
        .map_err(|e| e.to_string())
        .map(|entries| entries.into_iter().map(CommitEntryDto::from).collect())
}
