use std::path::Path;

fn ensure_safe_directory(path: &Path) {
    let Some(path_str) = path.to_str() else { return };
    // Git normalizes paths to forward slashes (important for UNC/Samba: \\server\share → //server/share)
    let path_str_norm = path_str.replace('\\', "/");
    let path_str = path_str_norm.as_str();

    let Ok(global_path) = git2::Config::find_global() else { return };
    let Ok(mut cfg) = git2::Config::open(&global_path) else { return };

    let mut already_set = false;
    if let Ok(mut entries) = cfg.multivar("safe.directory", None) {
        while let Some(entry) = entries.next() {
            if let Ok(e) = entry {
                if e.value().ok() == Some(path_str) {
                    already_set = true;
                    break;
                }
            }
        }
    }
    if !already_set {
        // "a^" never matches any existing value, so this always appends a new entry
        let _ = cfg.set_multivar("safe.directory", "a^", path_str);
    }
}

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
pub enum ChangeType {
    None,
    Minor,
    Meaningful,
}

pub fn classify_change(
    repo_path: &Path,
    filename: &str,
    status: &ChangeKind,
) -> ChangeType {
    match status {
        ChangeKind::New | ChangeKind::Deleted => ChangeType::Meaningful,
        ChangeKind::Modified => classify_modified(repo_path, filename),
    }
}

fn classify_modified(repo_path: &Path, filename: &str) -> ChangeType {
    let working_copy = match std::fs::read(repo_path.join(filename)) {
        Ok(b) => b,
        Err(_) => return ChangeType::Meaningful,
    };
    let head_bytes = match head_blob_bytes(repo_path, filename) {
        Some(b) => b,
        None => return ChangeType::Meaningful,
    };
    if working_copy == head_bytes {
        ChangeType::None
    } else {
        ChangeType::Meaningful
    }
}

fn head_blob_bytes(repo_path: &Path, filename: &str) -> Option<Vec<u8>> {
    ensure_safe_directory(repo_path);
    let repo = git2::Repository::open(repo_path).ok()?;
    let head = repo.head().ok()?;
    let commit = head.peel_to_commit().ok()?;
    let tree = commit.tree().ok()?;
    let entry = tree.get_name(filename)?;
    let blob = repo.find_blob(entry.id()).ok()?;
    Some(blob.content().to_vec())
}

#[derive(Debug, PartialEq)]
pub struct CommitEntry {
    pub oid: String,
    pub message: String,
    pub author: String,
    pub timestamp: i64,
    pub blob_oid: String,
}

pub fn commit_history(repo_path: &Path, filename: &str) -> Result<Vec<CommitEntry>, git2::Error> {
    ensure_safe_directory(repo_path);
    let repo = git2::Repository::open(repo_path)?;
    let mut walk = repo.revwalk()?;
    walk.push_head().ok();
    walk.set_sorting(git2::Sort::TIME)?;

    let mut entries = Vec::new();
    for oid in walk {
        let oid = oid?;
        let commit = repo.find_commit(oid)?;
        let tree = commit.tree()?;
        let Some(entry) = tree.get_name(filename) else { continue };

        let parent_id = commit
            .parent(0).ok()
            .and_then(|p| p.tree().ok())
            .and_then(|t| t.get_name(filename).map(|e| e.id()));

        if parent_id == Some(entry.id()) {
            continue;
        }

        entries.push(CommitEntry {
            oid: oid.to_string(),
            message: commit.message().unwrap_or("").trim().to_string(),
            author: commit.author().name().unwrap_or("").to_string(),
            timestamp: commit.time().seconds(),
            blob_oid: entry.id().to_string(),
        });
    }
    Ok(entries)
}

pub fn project_commits(repo_path: &Path) -> Result<Vec<CommitEntry>, git2::Error> {
    ensure_safe_directory(repo_path);
    let repo = git2::Repository::open(repo_path)?;
    let mut walk = repo.revwalk()?;
    walk.push_head().ok();
    walk.set_sorting(git2::Sort::TIME)?;

    let mut entries = Vec::new();
    for oid in walk {
        let oid = oid?;
        let commit = repo.find_commit(oid)?;
        entries.push(CommitEntry {
            oid: oid.to_string(),
            message: commit.message().unwrap_or("").trim().to_string(),
            author: commit.author().name().unwrap_or("").to_string(),
            timestamp: commit.time().seconds(),
            blob_oid: String::new(),
        });
    }
    Ok(entries)
}

pub fn changes_at_commit(repo_path: &Path, oid_str: &str) -> Result<Vec<PendingChange>, git2::Error> {
    ensure_safe_directory(repo_path);
    let repo = git2::Repository::open(repo_path)?;
    let oid = git2::Oid::from_str(oid_str).map_err(|e| git2::Error::from_str(&e.to_string()))?;
    let commit = repo.find_commit(oid)?;
    let tree = commit.tree()?;
    let parent_tree = commit.parent(0).ok().and_then(|p| p.tree().ok());

    let mut current: Vec<(String, git2::Oid)> = Vec::new();
    tree.walk(git2::TreeWalkMode::PreOrder, |_, entry| {
        if let Ok(name) = entry.name() {
            if name.ends_with(".pdf") {
                current.push((name.to_string(), entry.id()));
            }
        }
        git2::TreeWalkResult::Ok
    })?;

    let mut parent_map: std::collections::HashMap<String, git2::Oid> = std::collections::HashMap::new();
    if let Some(ref pt) = parent_tree {
        pt.walk(git2::TreeWalkMode::PreOrder, |_, entry| {
            if let Ok(name) = entry.name() {
                if name.ends_with(".pdf") {
                    parent_map.insert(name.to_string(), entry.id());
                }
            }
            git2::TreeWalkResult::Ok
        })?;
    }

    let mut changes: Vec<PendingChange> = Vec::new();
    let mut current_names: std::collections::HashSet<String> = std::collections::HashSet::new();

    for (name, blob_id) in current {
        current_names.insert(name.clone());
        let status = match parent_map.get(&name) {
            Some(pid) if *pid == blob_id => continue,
            Some(_) => ChangeKind::Modified,
            None => ChangeKind::New,
        };
        changes.push(PendingChange { filename: name, status });
    }

    for name in parent_map.keys() {
        if !current_names.contains(name) {
            changes.push(PendingChange { filename: name.clone(), status: ChangeKind::Deleted });
        }
    }

    Ok(changes)
}

pub fn drawings_at_commit(repo_path: &Path, oid_str: &str) -> Result<Vec<String>, git2::Error> {
    ensure_safe_directory(repo_path);
    let repo = git2::Repository::open(repo_path)?;
    let oid = git2::Oid::from_str(oid_str).map_err(|e| git2::Error::from_str(&e.to_string()))?;
    let commit = repo.find_commit(oid)?;
    let tree = commit.tree()?;

    let mut filenames = Vec::new();
    tree.walk(git2::TreeWalkMode::PreOrder, |_, entry| {
        if let Ok(name) = entry.name() {
            if name.ends_with(".pdf") {
                filenames.push(name.to_string());
            }
        }
        git2::TreeWalkResult::Ok
    })?;
    Ok(filenames)
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
    ensure_safe_directory(path);
    git2::Repository::init(path)?;
    std::fs::create_dir_all(path.join(".git").join("velgit"))?;
    Ok(())
}

pub fn pending_changes(repo_path: &Path) -> Result<Vec<PendingChange>, git2::Error> {
    ensure_safe_directory(repo_path);
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

pub fn commit(
    repo_path: &Path,
    message: &str,
    author: &str,
    included_files: &[String],
) -> Result<git2::Oid, git2::Error> {
    if message.is_empty() {
        return Err(git2::Error::from_str("commit message must not be empty"));
    }
    ensure_safe_directory(repo_path);
    let repo = git2::Repository::open(repo_path)?;
    let mut index = repo.index()?;

    // Reset index to HEAD so only the selected files are staged
    if let Ok(head) = repo.head() {
        let tree = head.peel_to_tree()?;
        index.read_tree(&tree)?;
    }
    for filename in included_files {
        let full_path = repo_path.join(filename);
        if full_path.exists() {
            index.add_path(std::path::Path::new(filename))?;
        } else {
            let _ = index.remove_path(std::path::Path::new(filename));
        }
    }
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

    // Test helper: commit all current pending changes (PDFs only).
    fn commit(dir: &std::path::Path, message: &str, author: &str) -> Result<git2::Oid, git2::Error> {
        let changes = pending_changes(dir)
            .map_err(|e| git2::Error::from_str(&e.to_string()))?;
        let files: Vec<String> = changes.iter().map(|c| c.filename.clone()).collect();
        super::commit(dir, message, author, &files)
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

    #[test]
    fn commit_history_excludes_commits_that_do_not_touch_the_file() {
        let dir = tempdir().unwrap();
        make_repo(dir.path());
        fs::write(dir.path().join("A-001_平面図.pdf"), b"v1").unwrap();
        commit(dir.path(), "A図面コミット", "user-a").unwrap();
        fs::write(dir.path().join("S-001_伏図.pdf"), b"s1").unwrap();
        commit(dir.path(), "S図面コミット", "user-a").unwrap();

        let history = commit_history(dir.path(), "A-001_平面図.pdf").unwrap();

        assert_eq!(history.len(), 1);
        assert_eq!(history[0].message, "A図面コミット");
    }

    #[test]
    fn commit_history_returns_two_entries_in_reverse_chronological_order() {
        let dir = tempdir().unwrap();
        make_repo(dir.path());
        fs::write(dir.path().join("A-001_平面図.pdf"), b"v1").unwrap();
        commit(dir.path(), "初回コミット", "user-a").unwrap();
        fs::write(dir.path().join("A-001_平面図.pdf"), b"v2").unwrap();
        commit(dir.path(), "2回目コミット", "user-b").unwrap();

        let history = commit_history(dir.path(), "A-001_平面図.pdf").unwrap();

        assert_eq!(history.len(), 2);
        assert_eq!(history[0].message, "2回目コミット");
        assert_eq!(history[1].message, "初回コミット");
        assert!(history[0].timestamp >= history[1].timestamp);
    }

    #[test]
    fn commit_history_records_author() {
        let dir = tempdir().unwrap();
        make_repo(dir.path());
        fs::write(dir.path().join("A-001_平面図.pdf"), b"v1").unwrap();

        commit(dir.path(), "初回コミット", "山田太郎").unwrap();

        let history = commit_history(dir.path(), "A-001_平面図.pdf").unwrap();

        assert_eq!(history[0].author, "山田太郎");
    }

    #[test]
    fn commit_history_returns_empty_for_file_never_committed() {
        let dir = tempdir().unwrap();
        make_repo(dir.path());
        fs::write(dir.path().join("A-001_平面図.pdf"), b"pdf").unwrap();

        let history = commit_history(dir.path(), "A-001_平面図.pdf").unwrap();

        assert!(history.is_empty());
    }

    #[test]
    fn classify_modified_with_identical_bytes_returns_none() {
        let dir = tempdir().unwrap();
        make_repo(dir.path());
        fs::write(dir.path().join("A-001_平面図.pdf"), b"same content").unwrap();
        commit(dir.path(), "初回コミット", "user-a").unwrap();
        // 作業コピーをHEADと同一バイトで上書き
        fs::write(dir.path().join("A-001_平面図.pdf"), b"same content").unwrap();

        let result = classify_change(dir.path(), "A-001_平面図.pdf", &ChangeKind::Modified);

        assert_eq!(result, ChangeType::None);
    }

    #[test]
    fn classify_deleted_file_returns_meaningful() {
        let dir = tempdir().unwrap();
        make_repo(dir.path());
        fs::write(dir.path().join("A-001_平面図.pdf"), b"content").unwrap();
        commit(dir.path(), "初回コミット", "user-a").unwrap();
        fs::remove_file(dir.path().join("A-001_平面図.pdf")).unwrap();

        let result = classify_change(dir.path(), "A-001_平面図.pdf", &ChangeKind::Deleted);

        assert_eq!(result, ChangeType::Meaningful);
    }

    #[test]
    fn classify_new_file_returns_meaningful() {
        let dir = tempdir().unwrap();
        make_repo(dir.path());
        fs::write(dir.path().join("A-001_平面図.pdf"), b"new content").unwrap();

        let result = classify_change(dir.path(), "A-001_平面図.pdf", &ChangeKind::New);

        assert_eq!(result, ChangeType::Meaningful);
    }

    #[test]
    fn project_commits_returns_empty_for_repo_with_no_commits() {
        let dir = tempdir().unwrap();
        make_repo(dir.path());

        let commits = project_commits(dir.path()).unwrap();

        assert!(commits.is_empty());
    }

    #[test]
    fn project_commits_returns_all_commits_in_reverse_chronological_order() {
        let dir = tempdir().unwrap();
        make_repo(dir.path());
        fs::write(dir.path().join("A-001_平面図.pdf"), b"v1").unwrap();
        commit(dir.path(), "初回コミット", "user-a").unwrap();
        fs::write(dir.path().join("S-001_伏図.pdf"), b"s1").unwrap();
        commit(dir.path(), "2回目コミット", "user-b").unwrap();

        let commits = project_commits(dir.path()).unwrap();

        assert_eq!(commits.len(), 2);
        assert_eq!(commits[0].message, "2回目コミット");
        assert_eq!(commits[1].message, "初回コミット");
        assert!(commits[0].timestamp >= commits[1].timestamp);
    }

    #[test]
    fn project_commits_includes_commits_regardless_of_which_file_changed() {
        let dir = tempdir().unwrap();
        make_repo(dir.path());
        fs::write(dir.path().join("A-001_平面図.pdf"), b"v1").unwrap();
        commit(dir.path(), "A図面コミット", "user-a").unwrap();
        fs::write(dir.path().join("S-001_伏図.pdf"), b"s1").unwrap();
        commit(dir.path(), "S図面コミット", "user-a").unwrap();

        let commits = project_commits(dir.path()).unwrap();

        assert_eq!(commits.len(), 2);
    }

    #[test]
    fn project_commits_records_author() {
        let dir = tempdir().unwrap();
        make_repo(dir.path());
        fs::write(dir.path().join("A-001_平面図.pdf"), b"v1").unwrap();
        commit(dir.path(), "初回コミット", "山田太郎").unwrap();

        let commits = project_commits(dir.path()).unwrap();

        assert_eq!(commits[0].author, "山田太郎");
    }

    #[test]
    fn drawings_at_commit_returns_pdfs_present_at_that_commit() {
        let dir = tempdir().unwrap();
        make_repo(dir.path());
        fs::write(dir.path().join("A-001_平面図.pdf"), b"v1").unwrap();
        fs::write(dir.path().join("S-001_伏図.pdf"), b"s1").unwrap();
        let oid = commit(dir.path(), "初回コミット", "user-a").unwrap();

        let filenames = drawings_at_commit(dir.path(), &oid.to_string()).unwrap();

        assert_eq!(filenames.len(), 2);
        assert!(filenames.contains(&"A-001_平面図.pdf".to_string()));
        assert!(filenames.contains(&"S-001_伏図.pdf".to_string()));
    }

    #[test]
    fn drawings_at_commit_ignores_non_pdf_files() {
        let dir = tempdir().unwrap();
        make_repo(dir.path());
        fs::write(dir.path().join("A-001_平面図.pdf"), b"v1").unwrap();
        fs::write(dir.path().join("notes.txt"), b"text").unwrap();
        let oid = commit(dir.path(), "初回コミット", "user-a").unwrap();

        let filenames = drawings_at_commit(dir.path(), &oid.to_string()).unwrap();

        assert_eq!(filenames.len(), 1);
        assert!(filenames.contains(&"A-001_平面図.pdf".to_string()));
    }

    #[test]
    fn drawings_at_commit_reflects_state_at_that_point_in_time() {
        let dir = tempdir().unwrap();
        make_repo(dir.path());
        fs::write(dir.path().join("A-001_平面図.pdf"), b"v1").unwrap();
        let oid_first = commit(dir.path(), "初回コミット", "user-a").unwrap();
        fs::write(dir.path().join("S-001_伏図.pdf"), b"s1").unwrap();
        commit(dir.path(), "2回目コミット", "user-a").unwrap();

        let filenames = drawings_at_commit(dir.path(), &oid_first.to_string()).unwrap();

        assert_eq!(filenames.len(), 1);
        assert!(filenames.contains(&"A-001_平面図.pdf".to_string()));
    }
}
