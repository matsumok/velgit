use std::path::Path;

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

#[derive(Debug, PartialEq)]
pub enum ChangeKind {
    New,
    Modified,
    Deleted,
}

#[derive(Debug)]
pub struct PendingChange {
    pub filename: String,
    pub status: ChangeKind,
}

pub fn init(path: &Path) -> Result<(), InitError> {
    git2::Repository::init(path)?;
    std::fs::create_dir_all(path.join(".git").join("velgit"))?;
    Ok(())
}

pub fn pending_changes(repo_path: &Path) -> Result<Vec<PendingChange>, git2::Error> {
    let repo = git2::Repository::open(repo_path)?;
    let statuses = repo.statuses(None)?;
    let changes = statuses
        .iter()
        .filter_map(|entry| {
            let path = entry.path().unwrap_or_default();
            if !path.to_lowercase().ends_with(".pdf") {
                return None;
            }
            let flags = entry.status();
            let status = if flags.contains(git2::Status::INDEX_NEW)
                || flags.contains(git2::Status::WT_NEW)
            {
                ChangeKind::New
            } else if flags.contains(git2::Status::INDEX_MODIFIED)
                || flags.contains(git2::Status::WT_MODIFIED)
            {
                ChangeKind::Modified
            } else if flags.contains(git2::Status::INDEX_DELETED)
                || flags.contains(git2::Status::WT_DELETED)
            {
                ChangeKind::Deleted
            } else {
                return None;
            };
            Some(PendingChange {
                filename: path.to_string(),
                status,
            })
        })
        .collect();
    Ok(changes)
}

pub fn commit(repo_path: &Path, message: &str, author: &str) -> Result<git2::Oid, git2::Error> {
    if message.is_empty() {
        return Err(git2::Error::from_str("commit message must not be empty"));
    }
    let repo = git2::Repository::open(repo_path)?;
    let mut index = repo.index()?;
    index.add_all(["*"].iter(), git2::IndexAddOption::DEFAULT, None)?;
    index.write()?;
    let tree_oid = index.write_tree()?;
    let tree = repo.find_tree(tree_oid)?;
    let sig = git2::Signature::now(author, "velgit@local")?;
    let parents: Vec<git2::Commit> = match repo.head() {
        Ok(head) => vec![head.peel_to_commit()?],
        Err(_) => vec![],
    };
    let parent_refs: Vec<&git2::Commit> = parents.iter().collect();
    repo.commit(Some("HEAD"), &sig, &sig, message, &tree, &parent_refs)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::tempdir;

    fn make_repo(dir: &std::path::Path) {
        git2::Repository::init(dir).unwrap();
    }

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
        init(dir.path()).unwrap();
    }

    #[test]
    fn pending_changes_empty_on_clean_repo() {
        let dir = tempdir().unwrap();
        make_repo(dir.path());
        let changes = pending_changes(dir.path()).unwrap();
        assert!(changes.is_empty());
    }

    #[test]
    fn pending_changes_returns_new_for_untracked_pdf() {
        let dir = tempdir().unwrap();
        make_repo(dir.path());
        fs::write(dir.path().join("A-001_平面図.pdf"), b"pdf").unwrap();

        let changes = pending_changes(dir.path()).unwrap();

        assert_eq!(changes.len(), 1);
        assert_eq!(changes[0].filename, "A-001_平面図.pdf");
        assert_eq!(changes[0].status, ChangeKind::New);
    }

    #[test]
    fn pending_changes_ignores_non_pdf_files() {
        let dir = tempdir().unwrap();
        make_repo(dir.path());
        fs::write(dir.path().join("notes.txt"), b"text").unwrap();
        fs::write(dir.path().join("A-001_平面図.pdf"), b"pdf").unwrap();

        let changes = pending_changes(dir.path()).unwrap();

        assert_eq!(changes.len(), 1);
        assert_eq!(changes[0].filename, "A-001_平面図.pdf");
    }

    #[test]
    fn commit_clears_pending_changes() {
        let dir = tempdir().unwrap();
        make_repo(dir.path());
        fs::write(dir.path().join("A-001_平面図.pdf"), b"pdf").unwrap();

        commit(dir.path(), "初回コミット", "velgit-user").unwrap();

        let changes = pending_changes(dir.path()).unwrap();
        assert!(changes.is_empty());
    }

    #[test]
    fn pending_changes_returns_modified_after_edit() {
        let dir = tempdir().unwrap();
        make_repo(dir.path());
        fs::write(dir.path().join("A-001_平面図.pdf"), b"v1").unwrap();
        commit(dir.path(), "初回コミット", "velgit-user").unwrap();
        fs::write(dir.path().join("A-001_平面図.pdf"), b"v2").unwrap();

        let changes = pending_changes(dir.path()).unwrap();

        assert_eq!(changes.len(), 1);
        assert_eq!(changes[0].status, ChangeKind::Modified);
    }

    #[test]
    fn pending_changes_returns_deleted_after_removal() {
        let dir = tempdir().unwrap();
        make_repo(dir.path());
        fs::write(dir.path().join("A-001_平面図.pdf"), b"pdf").unwrap();
        commit(dir.path(), "初回コミット", "velgit-user").unwrap();
        fs::remove_file(dir.path().join("A-001_平面図.pdf")).unwrap();

        let changes = pending_changes(dir.path()).unwrap();

        assert_eq!(changes.len(), 1);
        assert_eq!(changes[0].status, ChangeKind::Deleted);
    }

    #[test]
    fn commit_returns_error_for_empty_message() {
        let dir = tempdir().unwrap();
        make_repo(dir.path());
        fs::write(dir.path().join("A-001_平面図.pdf"), b"pdf").unwrap();

        let result = commit(dir.path(), "", "velgit-user");

        assert!(result.is_err());
    }
}
