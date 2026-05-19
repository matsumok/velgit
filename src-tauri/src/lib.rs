use git2::Repository;
use std::collections::HashMap;

#[derive(serde::Serialize)]
pub struct RepoInfo {
    pub name: String,
    pub path: String,
    pub branch: String,
    pub head_sha: String,
    pub head_message: String,
}

#[derive(serde::Serialize)]
pub struct CommitAuthor {
    pub name: String,
    pub email: String,
}

// git2json 互換フォーマット。@gitgraph/react の import() に直接渡せる。
#[derive(serde::Serialize)]
pub struct CommitInfo {
    pub hash: String,
    pub short_sha: String,
    pub subject: String,
    pub author: CommitAuthor,
    pub timestamp: i64,
    pub parents: Vec<String>,
    pub refs: Vec<String>,
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

    // sha -> ref名リスト（ブランチ・タグ）
    let mut ref_map: HashMap<String, Vec<String>> = HashMap::new();
    if let Ok(references) = repo.references() {
        for reference in references.flatten() {
            let shorthand = match reference.shorthand() {
                Ok(s) if !s.is_empty() => s.to_string(),
                _ => continue,
            };
            if let Ok(commit) = reference.peel_to_commit() {
                ref_map.entry(commit.id().to_string()).or_default().push(shorthand);
            }
        }
    }
    // detached HEAD の場合のみ "HEAD" を追加
    if let Ok(head) = repo.head() {
        if !head.is_branch() {
            if let Ok(commit) = head.peel_to_commit() {
                ref_map.entry(commit.id().to_string()).or_default().insert(0, "HEAD".to_string());
            }
        }
    }

    let mut revwalk = repo.revwalk().map_err(|e| e.message().to_string())?;
    revwalk.push_head().map_err(|e| e.message().to_string())?;
    revwalk.set_sorting(git2::Sort::TIME).map_err(|e| e.message().to_string())?;

    let commits = revwalk
        .take(max_count)
        .filter_map(|oid| oid.ok())
        .filter_map(|oid| repo.find_commit(oid).ok())
        .map(|commit| {
            let hash = commit.id().to_string();
            let refs = ref_map.get(&hash).cloned().unwrap_or_default();
            CommitInfo {
                short_sha: hash[..7].to_string(),
                subject: commit.message().unwrap_or("").lines().next().unwrap_or("").to_string(),
                author: CommitAuthor {
                    name: commit.author().name().unwrap_or("unknown").to_string(),
                    email: commit.author().email().unwrap_or("").to_string(),
                },
                timestamp: commit.time().seconds(),
                parents: commit.parent_ids().map(|id| id.to_string()).collect(),
                refs,
                hash,
            }
        })
        .collect();

    Ok(commits)
}

#[tauri::command]
fn read_pdf_bytes(path: String) -> Result<tauri::ipc::Response, String> {
    let bytes = std::fs::read(&path).map_err(|e| e.to_string())?;
    Ok(tauri::ipc::Response::new(bytes))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![open_repo, get_commits, read_pdf_bytes])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
