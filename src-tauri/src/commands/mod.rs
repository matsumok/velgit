use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use tauri::State;

use crate::{
    repository::{CommitEntry, InitError},
    AppState,
};

pub mod commits;
pub mod drawings;
pub mod images;
pub mod project;
pub mod releases;

pub use commits::{commit_changes, get_commit_history, get_project_commits};
pub use drawings::{get_changes_at_commit, get_drawings, get_drawings_at_commit, get_pending_changes};
pub use images::{generate_diff, get_pdf_image, get_working_copy_image};
pub use project::{init_working_folder, is_initialized};
pub use releases::{create_release, generate_bind_pdf, generate_commit_bind_pdf, get_release_drawings, list_releases};

// ─── Shared DTOs ────────────────────────────────────────────────────────────

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
    pub blob_oid: Option<String>,
}

impl From<CommitEntry> for CommitEntryDto {
    fn from(e: CommitEntry) -> Self {
        CommitEntryDto {
            oid: e.oid,
            message: e.message,
            author: e.author,
            timestamp: e.timestamp,
            change_type: None,
            blob_oid: if e.blob_oid.is_empty() { None } else { Some(e.blob_oid) },
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

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GenerateDiffResult {
    pub change_type: String,
    pub url: Option<String>,
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

// ─── AppState helpers ────────────────────────────────────────────────────────

pub(crate) fn require_repo_path(state: &State<'_, AppState>) -> Result<PathBuf, String> {
    state
        .repo_path
        .lock()
        .unwrap()
        .clone()
        .ok_or_else(|| "ワーキングフォルダが選択されていません".to_string())
}

pub(crate) fn require_pool(state: &State<'_, AppState>) -> Result<sqlx::SqlitePool, String> {
    state
        .db
        .lock()
        .unwrap()
        .as_ref()
        .map(|db| db.0.clone())
        .ok_or_else(|| "ワーキングフォルダが選択されていません".to_string())
}

pub(crate) fn get_pool_opt(state: &State<'_, AppState>) -> Option<sqlx::SqlitePool> {
    state.db.lock().unwrap().as_ref().map(|db| db.0.clone())
}

// ─── Shared utilities ────────────────────────────────────────────────────────

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

pub fn velgit_db_path(folder: &Path) -> PathBuf {
    folder.join(".git").join("velgit").join("velgit.db")
}

pub fn scan_pdfs(path: &Path) -> Vec<String> {
    let Ok(entries) = std::fs::read_dir(path) else {
        return vec![];
    };
    entries
        .filter_map(|e| e.ok())
        .filter(|e| {
            e.path()
                .extension()
                .and_then(|s| s.to_str())
                == Some("pdf")
        })
        .filter_map(|e| e.file_name().into_string().ok())
        .collect()
}

pub fn extract_blob_with_oid(
    repo: &git2::Repository,
    oid_str: &str,
    filename: &str,
) -> Result<(String, Vec<u8>), String> {
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

pub fn extract_pdf_blob(
    repo: &git2::Repository,
    oid_str: &str,
    filename: &str,
) -> Result<Vec<u8>, String> {
    extract_blob_with_oid(repo, oid_str, filename).map(|(_, pdf)| pdf)
}

// ─── Tests ───────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::tempdir;

    #[test]
    fn is_initialized_returns_false_without_velgit_db() {
        let dir = tempdir().unwrap();
        fs::create_dir(dir.path().join(".git")).unwrap();
        assert!(!is_initialized(
            dir.path().to_str().unwrap().to_string()
        ));
    }

    #[test]
    fn is_initialized_returns_false_for_missing_folder() {
        assert!(!is_initialized(
            "/nonexistent/path/that/does/not/exist".to_string()
        ));
    }

    #[test]
    fn is_initialized_returns_true_for_initialized_folder() {
        let dir = tempdir().unwrap();
        let db_path = velgit_db_path(dir.path());
        fs::create_dir_all(db_path.parent().unwrap()).unwrap();
        fs::write(&db_path, b"").unwrap();
        assert!(is_initialized(
            dir.path().to_str().unwrap().to_string()
        ));
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
