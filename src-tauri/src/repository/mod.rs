use std::path::Path;

use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct CommitMeta {
    pub hash: String,
    pub message: String,
    pub author: String,
    pub timestamp: i64,
}

pub fn init(_path: &Path) -> Result<(), git2::Error> {
    todo!()
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
