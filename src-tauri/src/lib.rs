use git2::Repository;

#[derive(serde::Serialize)]
pub struct RepoInfo {
    pub name: String,
    pub path: String,
    pub branch: String,
    pub head_sha: String,
    pub head_message: String,
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

    let branch = head
        .shorthand()
        .unwrap_or("HEAD detached")
        .to_string();

    let commit = head
        .peel_to_commit()
        .map_err(|e| e.message().to_string())?;

    let head_sha = commit.id().to_string()[..7].to_string();
    let head_message = commit
        .message()
        .unwrap_or("")
        .lines()
        .next()
        .unwrap_or("")
        .to_string();

    Ok(RepoInfo {
        name,
        path,
        branch,
        head_sha,
        head_message,
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![open_repo])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
