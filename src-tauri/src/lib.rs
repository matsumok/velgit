use git2::Repository;
use pdfium_render::prelude::*;
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

fn load_pdfium() -> Result<Pdfium, String> {
    let bindings = Pdfium::bind_to_library(Pdfium::pdfium_platform_library_name_at_path("./"))
        .or_else(|_| Pdfium::bind_to_system_library())
        .map_err(|e| format!("pdfium.dll が見つかりません: {e}"))?;
    Ok(Pdfium::new(bindings))
}

#[tauri::command]
fn get_pdf_page_count(path: String) -> Result<u32, String> {
    let pdfium = load_pdfium()?;
    let doc = pdfium.load_pdf_from_file(&path, None).map_err(|e| e.to_string())?;
    Ok(doc.pages().len() as u32)
}

#[tauri::command]
fn render_pdf_page(path: String, page: u32, scale: f32) -> Result<tauri::ipc::Response, String> {
    let pdfium = load_pdfium()?;
    let doc = pdfium.load_pdf_from_file(&path, None).map_err(|e| e.to_string())?;

    let pages = doc.pages();
    let pdf_page = pages
        .get(page as i32)
        .map_err(|e| e.to_string())?;

    let render_config = PdfRenderConfig::new()
        .scale_page_by_factor(scale);

    let bitmap = pdf_page
        .render_with_config(&render_config)
        .map_err(|e| e.to_string())?;

    let png_bytes = bitmap
        .as_image()
        .map_err(|e| e.to_string())?
        .into_rgba8()
        .into_vec();

    // PNG エンコード
    let width = bitmap.width() as u32;
    let height = bitmap.height() as u32;
    let mut buf = Vec::new();
    {
        let mut encoder = png::Encoder::new(&mut buf, width, height);
        encoder.set_color(png::ColorType::Rgba);
        encoder.set_depth(png::BitDepth::Eight);
        let mut writer = encoder.write_header().map_err(|e| e.to_string())?;
        writer.write_image_data(&png_bytes).map_err(|e| e.to_string())?;
    }

    Ok(tauri::ipc::Response::new(buf))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            open_repo,
            get_commits,
            get_pdf_page_count,
            render_pdf_page,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
