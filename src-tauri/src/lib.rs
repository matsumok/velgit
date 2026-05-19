use git2::Repository;

#[derive(serde::Serialize)]
pub struct RepoInfo {
    pub name: String,
    pub path: String,
    pub branch: String,
    pub head_sha: String,
    pub head_message: String,
}

#[derive(serde::Serialize)]
pub struct CommitInfo {
    pub sha: String,
    pub short_sha: String,
    pub message: String,
    pub author: String,
    pub timestamp: i64,
}

#[tauri::command]
fn open_repo(path: String) -> Result<RepoInfo, String> {
    let repo = Repository::open(&path).map_err(|e| e.message().to_string())?;

    let name = std::path::Path::new(&path)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("unknown")
        .to_string();

    let head = repo.head().map_err(|e| e.message().to_string())?;
    let branch = head.shorthand().unwrap_or("HEAD detached").to_string();
    let commit = head.peel_to_commit().map_err(|e| e.message().to_string())?;
    let head_sha = commit.id().to_string()[..7].to_string();
    let head_message = commit
        .message()
        .unwrap_or("")
        .lines()
        .next()
        .unwrap_or("")
        .to_string();

    Ok(RepoInfo { name, path, branch, head_sha, head_message })
}

#[tauri::command]
fn get_commits(path: String, max_count: usize) -> Result<Vec<CommitInfo>, String> {
    let repo = Repository::open(&path).map_err(|e| e.message().to_string())?;
    let mut revwalk = repo.revwalk().map_err(|e| e.message().to_string())?;
    revwalk.push_head().map_err(|e| e.message().to_string())?;
    revwalk.set_sorting(git2::Sort::TIME).map_err(|e| e.message().to_string())?;

    let commits = revwalk
        .take(max_count)
        .filter_map(|oid| oid.ok())
        .filter_map(|oid| repo.find_commit(oid).ok())
        .map(|commit| CommitInfo {
            sha: commit.id().to_string(),
            short_sha: commit.id().to_string()[..7].to_string(),
            message: commit
                .message()
                .unwrap_or("")
                .lines()
                .next()
                .unwrap_or("")
                .to_string(),
            author: commit.author().name().unwrap_or("unknown").to_string(),
            timestamp: commit.time().seconds(),
        })
        .collect();

    Ok(commits)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![open_repo, get_commits])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
