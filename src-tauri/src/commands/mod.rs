use std::path::Path;

use serde::{Deserialize, Serialize};
use tauri::State;
use uuid::Uuid;

use crate::{
    db::{CommitFileRecord, DbPool},
    diff,
    pdf,
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
}

impl From<CommitEntry> for CommitEntryDto {
    fn from(e: CommitEntry) -> Self {
        CommitEntryDto { oid: e.oid, message: e.message, author: e.author, timestamp: e.timestamp }
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
    overrides: Vec<String>,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let repo_path = state.repo_path.lock().unwrap().clone();
    let Some(path) = repo_path else {
        return Err("ワーキングフォルダが選択されていません".to_string());
    };

    let pending = repository::pending_changes(&path).map_err(|e| e.to_string())?;

    let oid = repository::commit(&path, &message, "velgit-user")
        .map_err(|e| e.to_string())?;

    let pool = state.db.lock().unwrap().as_ref().map(|db| db.0.clone());
    if let Some(pool) = pool {
        let records: Vec<CommitFileRecord> = pending
            .iter()
            .map(|c| {
                let overridden = overrides.contains(&c.filename);
                let change_type = if overridden {
                    "meaningful".to_string()
                } else {
                    match repository::classify_change(&path, &c.filename, &c.status) {
                        repository::ChangeType::None => "none",
                        repository::ChangeType::Minor => "minor",
                        repository::ChangeType::Meaningful => "meaningful",
                    }
                    .to_string()
                };
                CommitFileRecord { filename: c.filename.clone(), change_type, overridden }
            })
            .collect();
        let db = DbPool(pool);
        db.insert_commit_files(&oid.to_string(), &records)
            .await
            .map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[tauri::command]
pub fn get_commit_history(filename: String, state: State<'_, AppState>) -> Result<Vec<CommitEntryDto>, String> {
    let repo_path = state.repo_path.lock().unwrap().clone();
    let Some(path) = repo_path else {
        return Ok(vec![]);
    };
    repository::commit_history(&path, &filename)
        .map_err(|e| e.to_string())
        .map(|entries| entries.into_iter().map(CommitEntryDto::from).collect())
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GenerateDiffResult {
    pub change_type: String,
    pub url: Option<String>,
}

fn extract_pdf_blob(repo: &git2::Repository, oid_str: &str, filename: &str) -> Result<Vec<u8>, String> {
    let oid = git2::Oid::from_str(oid_str).map_err(|e| e.to_string())?;
    let commit = repo.find_commit(oid).map_err(|e| e.to_string())?;
    let tree = commit.tree().map_err(|e| e.to_string())?;
    let entry = tree
        .get_name(filename)
        .ok_or_else(|| format!("{filename} はこのコミットに存在しません"))?;
    let blob = repo.find_blob(entry.id()).map_err(|e| e.to_string())?;
    Ok(blob.content().to_vec())
}

#[tauri::command]
pub fn generate_diff(
    filename: String,
    oid_a: String,
    oid_b: Option<String>,
    state: State<'_, AppState>,
) -> Result<GenerateDiffResult, String> {
    let repo_path = state.repo_path.lock().unwrap().clone();
    let Some(path) = repo_path else {
        return Err("ワーキングフォルダが選択されていません".to_string());
    };

    let repo = git2::Repository::open(&path).map_err(|e| e.to_string())?;

    let pdf_a = extract_pdf_blob(&repo, &oid_a, &filename)?;

    let pdf_b = if let Some(ref oid_b_str) = oid_b {
        // blob OID が同一ならラスタライズをスキップ
        let oid_a_parsed = git2::Oid::from_str(&oid_a).map_err(|e| e.to_string())?;
        let oid_b_parsed = git2::Oid::from_str(oid_b_str).map_err(|e| e.to_string())?;
        let commit_a = repo.find_commit(oid_a_parsed).map_err(|e| e.to_string())?;
        let commit_b = repo.find_commit(oid_b_parsed).map_err(|e| e.to_string())?;
        let blob_a_id = commit_a.tree().ok()
            .and_then(|t| t.get_name(&filename).map(|e| e.id()));
        let blob_b_id = commit_b.tree().ok()
            .and_then(|t| t.get_name(&filename).map(|e| e.id()));
        if blob_a_id.is_some() && blob_a_id == blob_b_id {
            return Ok(GenerateDiffResult { change_type: "none".to_string(), url: None });
        }
        extract_pdf_blob(&repo, oid_b_str, &filename)?
    } else {
        // oid_b=None: 作業コピーと比較。HEADがなければ差分なしを返す
        match std::fs::read(path.join(&filename)) {
            Ok(bytes) => bytes,
            Err(_) => return Ok(GenerateDiffResult { change_type: "none".to_string(), url: None }),
        }
    };

    let rgba_a = pdf::rasterize_to_image(&pdf_a, 0).map_err(|e| e.to_string())?;
    let rgba_b = pdf::rasterize_to_image(&pdf_b, 0).map_err(|e| e.to_string())?;

    let result = diff::diff(&rgba_a, &rgba_b);

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

    let id = Uuid::new_v4().to_string();
    let tmp_path = std::env::temp_dir().join(format!("velgit_diff_{id}.png"));
    std::fs::write(&tmp_path, &png_bytes).map_err(|e| e.to_string())?;
    state.temp_images.lock().unwrap().insert(id.clone(), tmp_path);

    Ok(GenerateDiffResult { change_type, url: Some(format!("velgit://image/{id}")) })
}

#[tauri::command]
pub fn get_pdf_image(
    filename: String,
    oid: String,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let repo_path = state.repo_path.lock().unwrap().clone();
    let Some(path) = repo_path else {
        return Err("ワーキングフォルダが選択されていません".to_string());
    };

    let repo = git2::Repository::open(&path).map_err(|e| e.to_string())?;
    let commit = repo
        .find_commit(git2::Oid::from_str(&oid).map_err(|e| e.to_string())?)
        .map_err(|e| e.to_string())?;
    let tree = commit.tree().map_err(|e| e.to_string())?;
    let entry = tree
        .get_name(&filename)
        .ok_or_else(|| format!("{filename} はこのコミットに存在しません"))?;
    let blob = repo
        .find_blob(entry.id())
        .map_err(|e| e.to_string())?;
    let pdf_bytes = blob.content();

    let png_bytes = pdf::rasterize(pdf_bytes, 0).map_err(|e| e.to_string())?;

    let id = Uuid::new_v4().to_string();
    let tmp_path = std::env::temp_dir().join(format!("velgit_img_{id}.png"));
    std::fs::write(&tmp_path, &png_bytes).map_err(|e| e.to_string())?;

    state
        .temp_images
        .lock()
        .unwrap()
        .insert(id.clone(), tmp_path);

    Ok(format!("velgit://image/{id}"))
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
