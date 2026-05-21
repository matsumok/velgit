use std::path::Path;

use serde::{Deserialize, Serialize};

#[derive(Debug)]
pub enum InitError {
    Git(git2::Error),
    Io(std::io::Error),
}

impl From<git2::Error> for InitError {
    fn from(e: git2::Error) -> Self {
        InitError::Git(e)
    }
}

impl From<std::io::Error> for InitError {
    fn from(e: std::io::Error) -> Self {
        InitError::Io(e)
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CommitMeta {
    pub hash: String,
    pub message: String,
    pub author: String,
    pub timestamp: i64,
}

pub fn init(path: &Path) -> Result<(), InitError> {
    git2::Repository::init(path)?;
    std::fs::create_dir_all(path.join(".git").join("velgit"))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn init_creates_git_dir() {
        let dir = tempdir().unwrap();
        init(dir.path()).unwrap();
        assert!(dir.path().join(".git").exists());
    }

    #[test]
    fn init_creates_velgit_dir() {
        let dir = tempdir().unwrap();
        init(dir.path()).unwrap();
        assert!(dir.path().join(".git").join("velgit").exists());
    }

    #[test]
    fn init_is_idempotent() {
        let dir = tempdir().unwrap();
        init(dir.path()).unwrap();
        init(dir.path()).unwrap(); // 2回目もエラーにならない
    }
}

pub fn commit(_repo_path: &Path, _message: &str, _author: &str) -> Result<String, git2::Error> {
    todo!()
}

pub fn list_commits(_repo_path: &Path) -> Result<Vec<CommitMeta>, git2::Error> {
    todo!()
}

pub fn read_blob(
    _repo_path: &Path,
    _commit_hash: &str,
    _filename: &str,
) -> Result<Vec<u8>, git2::Error> {
    todo!()
}
