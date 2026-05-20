use base64::Engine;
use git2::Repository;
use image::imageops;
use pdfium_render::prelude::*;
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Mutex;

pub struct PdfiumHandle(Mutex<Option<Pdfium>>);

// ── 共通データ型 ────────────────────────────────────────────────

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

// フロントの FileEntry と同一構造
#[derive(serde::Serialize)]
pub struct WorkingFileEntry {
    pub name: String,
    pub relative_path: String,
    pub status: String, // "modified" | "added" | "deleted" | "untracked"
}

#[derive(serde::Serialize)]
pub struct PageDiffResult {
    pub diff_png_b64: String, // base64 encoded PNG of diff overlay
    pub change_ratio: f32,    // 0.0 = identical, 1.0 = completely different
    pub changed_pixels: u32,
    pub total_pixels: u32,
    pub width: u32,
    pub height: u32,
}

// ── Git コマンド ────────────────────────────────────────────────

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
    if let Ok(head) = repo.head() {
        if !head.is_branch() {
            if let Ok(commit) = head.peel_to_commit() {
                ref_map
                    .entry(commit.id().to_string())
                    .or_default()
                    .insert(0, "HEAD".to_string());
            }
        }
    }

    let mut revwalk = repo.revwalk().map_err(|e| e.message().to_string())?;
    revwalk.push_head().map_err(|e| e.message().to_string())?;
    revwalk
        .set_sorting(git2::Sort::TIME)
        .map_err(|e| e.message().to_string())?;

    let commits = revwalk
        .take(max_count)
        .filter_map(|oid| oid.ok())
        .filter_map(|oid| repo.find_commit(oid).ok())
        .map(|commit| {
            let hash = commit.id().to_string();
            let refs = ref_map.get(&hash).cloned().unwrap_or_default();
            CommitInfo {
                short_sha: hash[..7].to_string(),
                subject: commit
                    .message()
                    .unwrap_or("")
                    .lines()
                    .next()
                    .unwrap_or("")
                    .to_string(),
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

/// 指定コミットで変更された PDF ファイルのパス一覧を返す。
/// commit_sha が空の場合は最初のコミット（初回追加ファイル）を対象にする。
#[tauri::command]
fn get_changed_files(repo_path: String, commit_sha: String) -> Result<Vec<String>, String> {
    let repo = Repository::open(&repo_path).map_err(|e| e.message().to_string())?;
    let oid = git2::Oid::from_str(&commit_sha).map_err(|e| e.to_string())?;
    let commit = repo.find_commit(oid).map_err(|e| e.to_string())?;

    let new_tree = commit.tree().map_err(|e| e.to_string())?;
    let old_tree = commit
        .parent(0)
        .ok()
        .and_then(|p| p.tree().ok());

    let diff = repo
        .diff_tree_to_tree(
            old_tree.as_ref(),
            Some(&new_tree),
            None,
        )
        .map_err(|e| e.to_string())?;

    let mut paths = Vec::new();
    diff.foreach(
        &mut |delta, _| {
            if let Some(path) = delta.new_file().path() {
                let s = path.to_string_lossy();
                if s.ends_with(".pdf") || s.ends_with(".PDF") {
                    paths.push(s.into_owned());
                }
            }
            true
        },
        None,
        None,
        None,
    )
    .map_err(|e| e.to_string())?;

    Ok(paths)
}

/// ワーキングツリーの変更ファイル一覧（PDF のみ）を返す。
/// ステージ済み・未ステージ両方を含む。
#[tauri::command]
fn get_working_tree_status(repo_path: String) -> Result<Vec<WorkingFileEntry>, String> {
    let repo = Repository::open(&repo_path).map_err(|e| e.message().to_string())?;
    let statuses = repo.statuses(None).map_err(|e| e.to_string())?;

    let mut entries = Vec::new();
    for entry in statuses.iter() {
        let path = match entry.path() {
            Ok(p) => p.to_string(),
            Err(_) => continue,
        };
        if !path.to_lowercase().ends_with(".pdf") {
            continue;
        }

        let s = entry.status();
        let status = if s.contains(git2::Status::WT_NEW) || s.contains(git2::Status::INDEX_NEW) {
            if s.contains(git2::Status::INDEX_NEW) { "added" } else { "untracked" }
        } else if s.contains(git2::Status::WT_DELETED) || s.contains(git2::Status::INDEX_DELETED) {
            "deleted"
        } else if s.intersects(
            git2::Status::WT_MODIFIED
                | git2::Status::INDEX_MODIFIED
                | git2::Status::WT_RENAMED
                | git2::Status::INDEX_RENAMED,
        ) {
            "modified"
        } else {
            continue;
        };

        let name = path.split('/').last().unwrap_or(&path).to_string();
        entries.push(WorkingFileEntry { name, relative_path: path, status: status.to_string() });
    }

    Ok(entries)
}

/// 指定ファイルをインデックスに追加する（git add）。
#[tauri::command]
fn stage_file(repo_path: String, relative_path: String) -> Result<(), String> {
    let repo = Repository::open(&repo_path).map_err(|e| e.message().to_string())?;
    let mut index = repo.index().map_err(|e| e.to_string())?;
    index
        .add_path(std::path::Path::new(&relative_path))
        .map_err(|e| e.to_string())?;
    index.write().map_err(|e| e.to_string())?;
    Ok(())
}

/// ステージ済みの変更をコミットする。署名は git config から取得する。
/// 戻り値は新しいコミットの short SHA。
#[tauri::command]
fn create_commit(repo_path: String, message: String) -> Result<String, String> {
    let repo = Repository::open(&repo_path).map_err(|e| e.message().to_string())?;
    let sig = repo.signature().map_err(|e| e.to_string())?;
    let mut index = repo.index().map_err(|e| e.to_string())?;
    let tree_id = index.write_tree().map_err(|e| e.to_string())?;
    let tree = repo.find_tree(tree_id).map_err(|e| e.to_string())?;

    let parents: Vec<git2::Commit> = match repo.head() {
        Ok(head) => vec![head.peel_to_commit().map_err(|e| e.to_string())?],
        Err(_) => vec![], // 初回コミット
    };
    let parent_refs: Vec<&git2::Commit> = parents.iter().collect();

    let oid = repo
        .commit(Some("HEAD"), &sig, &sig, &message, &tree, &parent_refs)
        .map_err(|e| e.to_string())?;

    Ok(oid.to_string()[..7].to_string())
}

// ── PDF ヘルパー ────────────────────────────────────────────────

fn init_pdfium() -> Result<Pdfium, String> {
    let exe_dir = std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(PathBuf::from))
        .unwrap_or_default();

    let bindings =
        Pdfium::bind_to_library(Pdfium::pdfium_platform_library_name_at_path(&exe_dir))
            .or_else(|_| Pdfium::bind_to_system_library())
            .map_err(|e| format!("pdfium.dll が見つかりません: {e}"))?;
    Ok(Pdfium::new(bindings))
}

/// git2 でコミットからファイルの blob バイト列を取得する。
fn blob_bytes(repo: &Repository, commit_sha: &str, file_path: &str) -> Result<Vec<u8>, String> {
    let oid = git2::Oid::from_str(commit_sha).map_err(|e| e.to_string())?;
    let commit = repo.find_commit(oid).map_err(|e| e.to_string())?;
    let tree = commit.tree().map_err(|e| e.to_string())?;
    let entry = tree
        .get_path(std::path::Path::new(file_path))
        .map_err(|_| format!("{file_path} が commit {commit_sha} に存在しません"))?;
    let blob = repo.find_blob(entry.id()).map_err(|e| e.to_string())?;
    Ok(blob.content().to_vec())
}

/// PDF バイト列の指定ページを RGBA ピクセル配列にレンダリングする。
fn render_to_rgba(
    pdfium: &Pdfium,
    pdf_bytes: &[u8],
    page: u32,
    scale: f32,
) -> Result<(Vec<u8>, u32, u32), String> {
    let doc = pdfium
        .load_pdf_from_byte_slice(pdf_bytes, None)
        .map_err(|e| e.to_string())?;
    let pages = doc.pages();
    let pdf_page = pages.get(page as i32).map_err(|e| e.to_string())?;
    let config = PdfRenderConfig::new().scale_page_by_factor(scale);
    let bitmap = pdf_page.render_with_config(&config).map_err(|e| e.to_string())?;
    let w = bitmap.width() as u32;
    let h = bitmap.height() as u32;
    let pixels = bitmap
        .as_image()
        .map_err(|e| e.to_string())?
        .into_rgba8()
        .into_vec();
    Ok((pixels, w, h))
}

/// RGBA ピクセル配列を PNG バイト列にエンコードする。
fn encode_png(pixels: &[u8], width: u32, height: u32) -> Result<Vec<u8>, String> {
    let mut buf = Vec::new();
    {
        let mut encoder = png::Encoder::new(&mut buf, width, height);
        encoder.set_color(png::ColorType::Rgba);
        encoder.set_depth(png::BitDepth::Eight);
        let mut writer = encoder.write_header().map_err(|e| e.to_string())?;
        writer.write_image_data(pixels).map_err(|e| e.to_string())?;
    }
    Ok(buf)
}

/// 2枚の RGBA 画像をピクセル比較し、差分オーバーレイ画像と変化ピクセル数を返す。
/// 変化ピクセルは赤でハイライト、変化なしは page_b をそのまま表示する。
fn compute_diff(
    pixels_a: &[u8],
    pixels_b: &[u8],
    width: u32,
    height: u32,
    threshold: u8,
) -> (Vec<u8>, u32) {
    let total = (width * height) as usize;
    let mut output = vec![255u8; total * 4];
    let mut changed = 0u32;

    for i in 0..total {
        let b = i * 4;
        let (ra, ga, ba) = (pixels_a[b], pixels_a[b + 1], pixels_a[b + 2]);
        let (rb, gb, bb) = (pixels_b[b], pixels_b[b + 1], pixels_b[b + 2]);

        let dist = ra.abs_diff(rb).max(ga.abs_diff(gb)).max(ba.abs_diff(bb));

        if dist > threshold {
            changed += 1;
            // page_b に赤を 60% ブレンド
            output[b]     = ((rb as u32 * 2 + 255 * 3) / 5) as u8;
            output[b + 1] = (gb as u32 * 2 / 5) as u8;
            output[b + 2] = (bb as u32 * 2 / 5) as u8;
            output[b + 3] = 255;
        } else {
            output[b]     = rb;
            output[b + 1] = gb;
            output[b + 2] = bb;
            output[b + 3] = 255;
        }
    }

    (output, changed)
}

/// 2つの RGBA 画像のサイズが異なる場合、page_a を page_b のサイズに合わせてリサイズする。
fn normalize_sizes(
    pixels_a: Vec<u8>,
    w_a: u32,
    h_a: u32,
    w_b: u32,
    h_b: u32,
) -> Vec<u8> {
    if w_a == w_b && h_a == h_b {
        return pixels_a;
    }
    let img = image::RgbaImage::from_raw(w_a, h_a, pixels_a)
        .expect("invalid pixel buffer");
    imageops::resize(&img, w_b, h_b, imageops::FilterType::Triangle).into_vec()
}

// ── PDF コマンド ────────────────────────────────────────────────

#[tauri::command]
fn get_pdf_page_count(
    pdfium_handle: tauri::State<PdfiumHandle>,
    path: String,
) -> Result<u32, String> {
    let mut guard = pdfium_handle.0.lock().map_err(|e| e.to_string())?;
    if guard.is_none() {
        *guard = Some(init_pdfium()?);
    }
    let pdfium = guard.as_ref().unwrap();
    let doc = pdfium
        .load_pdf_from_file(&path, None)
        .map_err(|e| e.to_string())?;
    Ok(doc.pages().len() as u32)
}

#[tauri::command]
fn get_pdf_page_count_at_commit(
    pdfium_handle: tauri::State<PdfiumHandle>,
    repo_path: String,
    commit_sha: String,
    file_path: String,
) -> Result<u32, String> {
    let mut guard = pdfium_handle.0.lock().map_err(|e| e.to_string())?;
    if guard.is_none() {
        *guard = Some(init_pdfium()?);
    }
    let pdfium = guard.as_ref().unwrap();
    let repo = Repository::open(&repo_path).map_err(|e| e.message().to_string())?;
    let bytes = blob_bytes(&repo, &commit_sha, &file_path)?;
    let doc = pdfium
        .load_pdf_from_byte_slice(&bytes, None)
        .map_err(|e| e.to_string())?;
    Ok(doc.pages().len() as u32)
}

#[tauri::command]
fn render_pdf_page(
    pdfium_handle: tauri::State<PdfiumHandle>,
    path: String,
    page: u32,
    scale: f32,
) -> Result<tauri::ipc::Response, String> {
    let mut guard = pdfium_handle.0.lock().map_err(|e| e.to_string())?;
    if guard.is_none() {
        *guard = Some(init_pdfium()?);
    }
    let pdfium = guard.as_ref().unwrap();
    let bytes = std::fs::read(&path).map_err(|e| e.to_string())?;
    let (pixels, w, h) = render_to_rgba(pdfium, &bytes, page, scale)?;
    Ok(tauri::ipc::Response::new(encode_png(&pixels, w, h)?))
}

/// 特定コミット時点の PDF ページを PNG として返す。
#[tauri::command]
fn render_pdf_page_at_commit(
    pdfium_handle: tauri::State<PdfiumHandle>,
    repo_path: String,
    commit_sha: String,
    file_path: String,
    page: u32,
    scale: f32,
) -> Result<tauri::ipc::Response, String> {
    let mut guard = pdfium_handle.0.lock().map_err(|e| e.to_string())?;
    if guard.is_none() {
        *guard = Some(init_pdfium()?);
    }
    let pdfium = guard.as_ref().unwrap();

    let repo = Repository::open(&repo_path).map_err(|e| e.message().to_string())?;
    let bytes = blob_bytes(&repo, &commit_sha, &file_path)?;
    let (pixels, w, h) = render_to_rgba(pdfium, &bytes, page, scale)?;
    Ok(tauri::ipc::Response::new(encode_png(&pixels, w, h)?))
}

/// 2つのコミット間で同一ファイルの指定ページを diff し、オーバーレイ PNG と変化率を返す。
#[tauri::command]
fn diff_pdf_pages_at_commits(
    pdfium_handle: tauri::State<PdfiumHandle>,
    repo_path: String,
    commit_a: String,
    commit_b: String,
    file_path: String,
    page: u32,
    scale: f32,
) -> Result<PageDiffResult, String> {
    let mut guard = pdfium_handle.0.lock().map_err(|e| e.to_string())?;
    if guard.is_none() {
        *guard = Some(init_pdfium()?);
    }
    let pdfium = guard.as_ref().unwrap();

    let repo = Repository::open(&repo_path).map_err(|e| e.message().to_string())?;
    let bytes_a = blob_bytes(&repo, &commit_a, &file_path)?;
    let bytes_b = blob_bytes(&repo, &commit_b, &file_path)?;

    let (pixels_a, w_a, h_a) = render_to_rgba(pdfium, &bytes_a, page, scale)?;
    let (pixels_b, w_b, h_b) = render_to_rgba(pdfium, &bytes_b, page, scale)?;

    // サイズが異なる場合は page_a を page_b のサイズに合わせる
    let pixels_a = normalize_sizes(pixels_a, w_a, h_a, w_b, h_b);

    let (diff_pixels, changed) = compute_diff(&pixels_a, &pixels_b, w_b, h_b, 10);
    let total = w_b * h_b;
    let png = encode_png(&diff_pixels, w_b, h_b)?;
    let diff_png_b64 = base64::engine::general_purpose::STANDARD.encode(&png);

    Ok(PageDiffResult {
        diff_png_b64,
        change_ratio: changed as f32 / total as f32,
        changed_pixels: changed,
        total_pixels: total,
        width: w_b,
        height: h_b,
    })
}

// ── アプリ起動 ────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(PdfiumHandle(Mutex::new(None)))
        .invoke_handler(tauri::generate_handler![
            open_repo,
            get_commits,
            get_changed_files,
            get_working_tree_status,
            stage_file,
            create_commit,
            get_pdf_page_count,
            get_pdf_page_count_at_commit,
            render_pdf_page,
            render_pdf_page_at_commit,
            diff_pdf_pages_at_commits,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
