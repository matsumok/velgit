use std::path::Path;

use serde::{Deserialize, Serialize};
use tauri::State;
use base64::{Engine as _, engine::general_purpose::STANDARD};

use crate::{
    db::{CommitFileRecord, DbPool},
    diff,
    image_cache,
    pdf,
    releases,
    repository::{self, ChangeKind, CommitEntry, InitError},
    watcher::FileWatcher,
    AppState,
};

#[derive(Debug, Serialize, Deserialize)]
pub struct DrawingDto {
    pub filename: String,
    pub added_at: i64,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CommitEntryDto {
    pub oid: String,
    pub message: String,
    pub author: String,
    pub timestamp: i64,
    pub change_type: Option<String>,
}

impl From<CommitEntry> for CommitEntryDto {
    fn from(e: CommitEntry) -> Self {
        CommitEntryDto {
            oid: e.oid,
            message: e.message,
            author: e.author,
            timestamp: e.timestamp,
            change_type: None,
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PendingChangeDto {
    pub filename: String,
    pub status: String,
    pub change_type: String,
}

pub fn scan_pdfs(path: &Path) -> Vec<String> {
    let Ok(entries) = std::fs::read_dir(path) else {
        return vec![];
    };
    entries
        .filter_map(|e| e.ok())
        .filter(|e| e.path().extension().and_then(|s| s.to_str()) == Some("pdf"))
        .filter_map(|e| e.file_name().into_string().ok())
        .collect()
}

#[derive(Debug)]
pub enum OpenError {
    Init(InitError),
    Db(sqlx::Error),
}

impl std::fmt::Display for OpenError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            OpenError::Init(e) => write!(f, "初期化エラー: {:?}", e),
            OpenError::Db(e) => write!(f, "DB エラー: {}", e),
        }
    }
}

impl From<InitError> for OpenError {
    fn from(e: InitError) -> Self {
        OpenError::Init(e)
    }
}

impl From<sqlx::Error> for OpenError {
    fn from(e: sqlx::Error) -> Self {
        OpenError::Db(e)
    }
}

pub fn velgit_db_path(folder: &Path) -> std::path::PathBuf {
    folder.join(".git").join("velgit").join("velgit.db")
}

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
    pool.insert_drawings(&pdfs).await.map_err(|e| e.to_string())?;

    let fw = FileWatcher::new(path, app_handle);

    *state.repo_path.lock().unwrap() = Some(path.to_path_buf());
    *state.db.lock().unwrap() = Some(pool);
    *state.watcher.lock().unwrap() = Some(fw);

    Ok(())
}

#[tauri::command]
pub fn get_pending_changes(state: State<'_, AppState>) -> Result<Vec<PendingChangeDto>, String> {
    let repo_path = state.repo_path.lock().unwrap().clone();
    let Some(path) = repo_path else {
        return Ok(vec![]);
    };
    repository::pending_changes(&path)
        .map_err(|e| e.to_string())
        .map(|changes| {
            changes
                .into_iter()
                .map(|c| {
                    let change_type = match repository::classify_change(&path, &c.filename, &c.status) {
                        repository::ChangeType::None => "none",
                        repository::ChangeType::Minor => "minor",
                        repository::ChangeType::Meaningful => "meaningful",
                    }.to_string();
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


#[tauri::command]
pub async fn commit_changes(
    message: String,
    included_files: Vec<String>,
    created_by: String,
    state: State<'_, AppState>,
    app_handle: tauri::AppHandle,
) -> Result<(), String> {
    let repo_path = state.repo_path.lock().unwrap().clone();
    let Some(path) = repo_path else {
        return Err("ワーキングフォルダが選択されていません".to_string());
    };

    if included_files.is_empty() {
        return Err("コミット対象のファイルが選択されていません".to_string());
    }

    let pending = repository::pending_changes(&path).map_err(|e| e.to_string())?;
    let pending_map: std::collections::HashMap<_, _> =
        pending.iter().map(|c| (c.filename.as_str(), c)).collect();

    let oid = repository::commit(&path, &message, &created_by, &included_files)
        .map_err(|e| e.to_string())?;
    let oid_str = oid.to_string();

    let pool = state.db.lock().unwrap().as_ref().map(|db| db.0.clone());
    if let Some(pool) = &pool {
        // 初期レコードをバイト比較結果で即時挿入（高速）
        let records: Vec<CommitFileRecord> = included_files
            .iter()
            .filter_map(|filename| {
                let c = pending_map.get(filename.as_str())?;
                let change_type = match repository::classify_change(&path, &c.filename, &c.status) {
                    repository::ChangeType::None => "none",
                    repository::ChangeType::Minor => "minor",
                    repository::ChangeType::Meaningful => "meaningful",
                }
                .to_string();
                Some(CommitFileRecord { filename: c.filename.clone(), change_type, overridden: false })
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

                let Some((blob_oid_new, pdf_new, old_info)) = blobs else { continue; };

                // 新バージョンをキャッシュ（コミット直後から即アクセス可能に）
                let png_new = image_cache::get_or_rasterize(&pool, &pdf_new, &blob_oid_new, 0).await.ok();

                // 旧バージョンもキャッシュ（diff 表示時の再ラスタライズを防ぐ）
                let png_old = if let Some((blob_oid_old, pdf_old)) = old_info {
                    image_cache::get_or_rasterize(&pool, &pdf_old, &blob_oid_old, 0).await.ok()
                } else {
                    None
                };

                // キャッシュ済み PNG からビジュアル差分を計算
                let change_type = match (png_new, png_old) {
                    (Some(pn), Some(po)) => {
                        tokio::task::spawn_blocking(move || {
                            let rn = image_cache::decode_to_rgba(&pn).ok()?;
                            let ro = image_cache::decode_to_rgba(&po).ok()?;
                            Some(match diff::diff(&ro, &rn).change_type {
                                diff::ChangeType::None => "none",
                                diff::ChangeType::Minor => "minor",
                                diff::ChangeType::Meaningful => "meaningful",
                            }.to_string())
                        })
                        .await
                        .ok()
                        .flatten()
                        .unwrap_or_else(|| "meaningful".to_string())
                    }
                    _ => "meaningful".to_string(),
                };

                let db = DbPool(pool.clone());
                let _ = db.update_commit_file_change_type(&oid_bg, &filename, &change_type).await;
            }
            let _ = app_handle_bg.emit("commit-classified", ());
        });
    }

    Ok(())
}

#[tauri::command]
pub async fn get_commit_history(
    filename: String,
    state: State<'_, AppState>,
) -> Result<Vec<CommitEntryDto>, String> {
    let repo_path = state.repo_path.lock().unwrap().clone();
    let Some(path) = repo_path else {
        return Ok(vec![]);
    };
    let pool = state.db.lock().unwrap().as_ref().map(|db| db.0.clone());

    let entries = repository::commit_history(&path, &filename).map_err(|e| e.to_string())?;

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
            }
        })
        .collect();
    Ok(dtos)
}

#[tauri::command]
pub fn get_project_commits(state: State<'_, AppState>) -> Result<Vec<CommitEntryDto>, String> {
    let repo_path = state.repo_path.lock().unwrap().clone();
    let Some(path) = repo_path else {
        return Ok(vec![]);
    };
    repository::project_commits(&path)
        .map_err(|e| e.to_string())
        .map(|entries| entries.into_iter().map(CommitEntryDto::from).collect())
}

#[tauri::command]
pub fn get_drawings_at_commit(oid: String, state: State<'_, AppState>) -> Result<Vec<String>, String> {
    let repo_path = state.repo_path.lock().unwrap().clone();
    let Some(path) = repo_path else {
        return Ok(vec![]);
    };
    repository::drawings_at_commit(&path, &oid).map_err(|e| e.to_string())
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GenerateDiffResult {
    pub change_type: String,
    pub url: Option<String>,
}

#[tauri::command]
pub async fn generate_bind_pdf(
    release_id: i64,
    save_path: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let repo_path = state.repo_path.lock().unwrap().clone();
    let Some(path) = repo_path else {
        return Err("ワーキングフォルダが選択されていません".to_string());
    };
    let pool = state.db.lock().unwrap().as_ref().map(|db| db.0.clone());
    let Some(pool) = pool else {
        return Err("DB が開かれていません".to_string());
    };

    let release = releases::get_by_id(&pool, release_id)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| format!("リリース {release_id} が見つかりません"))?;

    let mut filenames = releases::get_drawings(&pool, release_id)
        .await
        .map_err(|e| e.to_string())?;
    filenames.sort();

    let repo = git2::Repository::open(&path).map_err(|e| e.to_string())?;
    let mut pdf_bytes_list: Vec<Vec<u8>> = Vec::new();
    for filename in &filenames {
        let bytes = extract_pdf_blob(&repo, &release.commit_oid, filename)?;
        pdf_bytes_list.push(bytes);
    }

    let bound = pdf::bind(&pdf_bytes_list).map_err(|e| e.to_string())?;
    std::fs::write(&save_path, &bound).map_err(|e| e.to_string())?;
    Ok(())
}

fn extract_blob_with_oid(repo: &git2::Repository, oid_str: &str, filename: &str) -> Result<(String, Vec<u8>), String> {
    let oid = git2::Oid::from_str(oid_str).map_err(|e| e.to_string())?;
    let commit = repo.find_commit(oid).map_err(|e| e.to_string())?;
    let tree = commit.tree().map_err(|e| e.to_string())?;
    let entry = tree
        .get_name(filename)
        .ok_or_else(|| format!("{filename} はこのコミットに存在しません"))?;
    let blob_oid = entry.id().to_string();
    let blob = repo.find_blob(entry.id()).map_err(|e| e.to_string())?;
    Ok((blob_oid, blob.content().to_vec()))
}

fn extract_pdf_blob(repo: &git2::Repository, oid_str: &str, filename: &str) -> Result<Vec<u8>, String> {
    extract_blob_with_oid(repo, oid_str, filename).map(|(_, pdf)| pdf)
}

#[tauri::command]
pub async fn generate_diff(
    filename: String,
    oid_a: String,
    oid_b: Option<String>,
    state: State<'_, AppState>,
) -> Result<GenerateDiffResult, String> {
    let repo_path = state.repo_path.lock().unwrap().clone();
    let pool = state.db.lock().unwrap().as_ref().map(|db| db.0.clone());
    let Some(path) = repo_path else {
        return Err("ワーキングフォルダが選択されていません".to_string());
    };

    // git2 は !Send のためスコープ内で完結させる
    let (blob_oid_a, pdf_a, blob_oid_b, pdf_b) = {
        let repo = git2::Repository::open(&path).map_err(|e| e.to_string())?;
        let (blob_oid_a, pdf_a) = extract_blob_with_oid(&repo, &oid_a, &filename)?;

        match oid_b {
            Some(ref oid_b_str) => {
                let (blob_oid_b, pdf_b) = extract_blob_with_oid(&repo, oid_b_str, &filename)?;
                if blob_oid_a == blob_oid_b {
                    return Ok(GenerateDiffResult { change_type: "none".to_string(), url: None });
                }
                (blob_oid_a, pdf_a, Some(blob_oid_b), pdf_b)
            }
            None => {
                // 作業コピーと比較。ファイルがなければ差分なしを返す
                let pdf_b = match std::fs::read(path.join(&filename)) {
                    Ok(bytes) => bytes,
                    Err(_) => return Ok(GenerateDiffResult { change_type: "none".to_string(), url: None }),
                };
                (blob_oid_a, pdf_a, None::<String>, pdf_b)
            }
        }
    };

    // blob_a: キャッシュ経由でラスタライズ
    let png_a = if let Some(ref pool) = pool {
        image_cache::get_or_rasterize(pool, &pdf_a, &blob_oid_a, 0).await?
    } else {
        pdf::rasterize(&pdf_a, 0).map_err(|e| e.to_string())?
    };

    // blob_b: コミット済みならキャッシュ経由、作業コピーは都度ラスタライズ
    let png_b = if let (Some(ref pool), Some(ref b_oid)) = (&pool, &blob_oid_b) {
        image_cache::get_or_rasterize(pool, &pdf_b, b_oid, 0).await?
    } else {
        tokio::task::spawn_blocking(move || {
            pdf::rasterize(&pdf_b, 0).map_err(|e| e.to_string())
        })
        .await
        .map_err(|e| e.to_string())?
        ?
    };

    // PNG → RGBA デコードと差分計算（CPU 重い処理をブロッキングスレッドで実行）
    let result = tokio::task::spawn_blocking(move || -> Result<diff::DiffResult, String> {
        let rgba_a = image_cache::decode_to_rgba(&png_a)?;
        let rgba_b = image_cache::decode_to_rgba(&png_b)?;
        Ok(diff::diff(&rgba_a, &rgba_b))
    })
    .await
    .map_err(|e| e.to_string())?
    ?;

    let change_type = match result.change_type {
        diff::ChangeType::None => "none",
        diff::ChangeType::Minor => "minor",
        diff::ChangeType::Meaningful => "meaningful",
    }.to_string();

    if result.change_type == diff::ChangeType::None {
        return Ok(GenerateDiffResult { change_type, url: None });
    }

    let overlay = result.overlay.unwrap();
    let mut png_bytes = Vec::new();
    overlay
        .write_to(&mut std::io::Cursor::new(&mut png_bytes), image::ImageFormat::Png)
        .map_err(|e| e.to_string())?;

    let url = format!("data:image/png;base64,{}", STANDARD.encode(&png_bytes));
    Ok(GenerateDiffResult { change_type, url: Some(url) })
}

#[tauri::command]
pub async fn get_pdf_image(
    filename: String,
    oid: String,
    size: Option<String>,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let repo_path = state.repo_path.lock().unwrap().clone();
    let pool = state.db.lock().unwrap().as_ref().map(|db| db.0.clone());
    let Some(path) = repo_path else {
        return Err("ワーキングフォルダが選択されていません".to_string());
    };

    // git2 は !Send のためスコープ内で完結させる
    let (blob_oid, pdf_bytes) = {
        let repo = git2::Repository::open(&path).map_err(|e| e.to_string())?;
        extract_blob_with_oid(&repo, &oid, &filename)?
    };

    let full_png = if let Some(ref pool) = pool {
        image_cache::get_or_rasterize(pool, &pdf_bytes, &blob_oid, 0).await?
    } else {
        pdf::rasterize(&pdf_bytes, 0).map_err(|e| e.to_string())?
    };

    let result_png = if size.as_deref() == Some("thumb") {
        tokio::task::spawn_blocking(move || image_cache::resize_to_thumb(&full_png))
            .await
            .map_err(|e| e.to_string())?
            ?
    } else {
        full_png
    };

    Ok(format!("data:image/png;base64,{}", STANDARD.encode(&result_png)))
}

#[tauri::command]
pub async fn get_working_copy_image(
    filename: String,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let repo_path = state.repo_path.lock().unwrap().clone();
    let Some(path) = repo_path else {
        return Err("ワーキングフォルダが選択されていません".to_string());
    };

    let pdf_bytes = std::fs::read(path.join(&filename)).map_err(|e| e.to_string())?;

    let png_bytes = tokio::task::spawn_blocking(move || {
        pdf::rasterize(&pdf_bytes, 0).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
    ?;

    Ok(format!("data:image/png;base64,{}", STANDARD.encode(&png_bytes)))
}

#[tauri::command]
pub fn get_drawings(state: State<'_, AppState>) -> Result<Vec<DrawingDto>, String> {
    let repo_path = state.repo_path.lock().unwrap().clone();
    let Some(path) = repo_path else {
        return Ok(vec![]);
    };
    let filenames = scan_pdfs(&path);
    Ok(filenames
        .into_iter()
        .map(|filename| DrawingDto { filename, added_at: 0 })
        .collect())
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReleaseEntryDto {
    pub id: i64,
    pub name: String,
    pub kind: String,
    pub recipient: Option<String>,
    pub commit_oid: String,
    pub created_at: i64,
    pub created_by: String,
    pub drawing_count: i64,
}

#[tauri::command]
pub async fn create_release(
    name: String,
    kind: String,
    recipient: Option<String>,
    drawing_filenames: Vec<String>,
    created_by: String,
    state: State<'_, AppState>,
) -> Result<i64, String> {
    let repo_path = state.repo_path.lock().unwrap().clone();
    let Some(path) = repo_path else {
        return Err("ワーキングフォルダが選択されていません".to_string());
    };
    let repo = git2::Repository::open(&path).map_err(|e| e.to_string())?;
    let head_oid = repo
        .head()
        .and_then(|h| h.peel_to_commit())
        .map(|c| c.id().to_string())
        .map_err(|e| e.to_string())?;

    let pool = state.db.lock().unwrap().as_ref().map(|db| db.0.clone());
    let Some(pool) = pool else {
        return Err("DB が開かれていません".to_string());
    };

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
pub async fn list_releases(state: State<'_, AppState>) -> Result<Vec<ReleaseEntryDto>, String> {
    let pool = state.db.lock().unwrap().as_ref().map(|db| db.0.clone());
    let Some(pool) = pool else {
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
    let pool = state.db.lock().unwrap().as_ref().map(|db| db.0.clone());
    let Some(pool) = pool else {
        return Ok(vec![]);
    };
    releases::get_drawings(&pool, release_id)
        .await
        .map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::tempdir;

    #[test]
    fn is_initialized_returns_false_without_velgit_db() {
        let dir = tempdir().unwrap();
        // .git/ はあるが .git/velgit/velgit.db がない
        fs::create_dir(dir.path().join(".git")).unwrap();

        assert!(!is_initialized(dir.path().to_str().unwrap().to_string()));
    }

    #[test]
    fn is_initialized_returns_false_for_missing_folder() {
        assert!(!is_initialized("/nonexistent/path/that/does/not/exist".to_string()));
    }

    #[test]
    fn is_initialized_returns_true_for_initialized_folder() {
        let dir = tempdir().unwrap();
        let db_path = velgit_db_path(dir.path());
        fs::create_dir_all(db_path.parent().unwrap()).unwrap();
        fs::write(&db_path, b"").unwrap();

        assert!(is_initialized(dir.path().to_str().unwrap().to_string()));
    }

    #[test]
    fn scan_pdfs_returns_pdf_files() {
        let dir = tempdir().unwrap();
        fs::write(dir.path().join("A-001_平面図.pdf"), b"").unwrap();
        fs::write(dir.path().join("S-001_伏図.pdf"), b"").unwrap();
        fs::write(dir.path().join("notes.txt"), b"").unwrap();

        let result = scan_pdfs(dir.path());

        assert_eq!(result.len(), 2);
        assert!(result.contains(&"A-001_平面図.pdf".to_string()));
        assert!(result.contains(&"S-001_伏図.pdf".to_string()));
    }
}
