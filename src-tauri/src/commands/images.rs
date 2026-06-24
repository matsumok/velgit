use base64::{engine::general_purpose::STANDARD, Engine as _};
use tauri::State;

use crate::{diff, image_cache, pdf, png_encode_fast, repository, AppState};

use super::{extract_blob_with_oid, get_pool_opt, require_repo_path, GenerateDiffResult};

#[tauri::command]
pub async fn generate_diff(
    filename: String,
    oid_a: String,
    oid_b: Option<String>,
    state: State<'_, AppState>,
) -> Result<GenerateDiffResult, String> {
    let t0 = std::time::Instant::now();
    let path = require_repo_path(&state)?;
    let pool = get_pool_opt(&state);

    let (blob_oid_a, pdf_a, blob_oid_b, pdf_b) = match oid_b {
        Some(ref oid_b_str) => {
            let (blob_oid_a, pdf_a) = if let Some(ref pool) = pool {
                repository::resolve_blob_with_lineage(&path, &oid_a, &filename, pool).await?
            } else {
                let repo = git2::Repository::open(&path).map_err(|e| e.to_string())?;
                extract_blob_with_oid(&repo, &oid_a, &filename)?
            };
            let (blob_oid_b, pdf_b) = if let Some(ref pool) = pool {
                repository::resolve_blob_with_lineage(&path, oid_b_str, &filename, pool).await?
            } else {
                let repo = git2::Repository::open(&path).map_err(|e| e.to_string())?;
                extract_blob_with_oid(&repo, oid_b_str, &filename)?
            };
            if blob_oid_a == blob_oid_b {
                return Ok(GenerateDiffResult {
                    change_type: "none".to_string(),
                    url: None,
                });
            }
            (blob_oid_a, pdf_a, Some(blob_oid_b), pdf_b)
        }
        None => {
            // 作業コピーと比較。ファイルがなければ差分なしを返す
            let (blob_oid_a, pdf_a) = if let Some(ref pool) = pool {
                repository::resolve_blob_with_lineage(&path, &oid_a, &filename, pool).await?
            } else {
                let repo = git2::Repository::open(&path).map_err(|e| e.to_string())?;
                extract_blob_with_oid(&repo, &oid_a, &filename)?
            };
            let pdf_b = match std::fs::read(path.join(&filename)) {
                Ok(bytes) => bytes,
                Err(_) => {
                    return Ok(GenerateDiffResult {
                        change_type: "none".to_string(),
                        url: None,
                    })
                }
            };
            (blob_oid_a, pdf_a, None::<String>, pdf_b)
        }
    };
    eprintln!("[PERF] stage1 git blob extract: {:.3}s  pdf_a={}KB  pdf_b={}KB",
        t0.elapsed().as_secs_f64(), pdf_a.len() / 1024, pdf_b.len() / 1024);

    // blob_a: キャッシュ経由でラスタライズ
    let t1 = std::time::Instant::now();
    let rgba_a = if let Some(ref pool) = pool {
        let png = image_cache::get_or_rasterize(pool, &pdf_a, &blob_oid_a, 0).await?;
        let t_dec = std::time::Instant::now();
        let img = tokio::task::spawn_blocking(move || image_cache::decode_to_rgba(&png))
            .await.map_err(|e| e.to_string())??;
        eprintln!("[PERF] stage2 PNG decode: {:.3}s", t_dec.elapsed().as_secs_f64());
        img
    } else {
        pdf::rasterize_to_image(&pdf_a, 0).map_err(|e| e.to_string())?
    };
    eprintln!("[PERF] stage2 rasterize/cache A: {:.3}s  {}x{}", t1.elapsed().as_secs_f64(), rgba_a.width(), rgba_a.height());

    // blob_b: コミット済みならキャッシュ経由、作業コピーは都度ラスタライズ
    let t2 = std::time::Instant::now();
    let rgba_b = if let (Some(ref pool), Some(ref b_oid)) = (&pool, &blob_oid_b) {
        let png = image_cache::get_or_rasterize(pool, &pdf_b, b_oid, 0).await?;
        let t_dec = std::time::Instant::now();
        let img = tokio::task::spawn_blocking(move || image_cache::decode_to_rgba(&png))
            .await.map_err(|e| e.to_string())??;
        eprintln!("[PERF] stage3 PNG decode: {:.3}s", t_dec.elapsed().as_secs_f64());
        img
    } else {
        tokio::task::spawn_blocking(move || {
            pdf::rasterize_to_image(&pdf_b, 0).map_err(|e| e.to_string())
        })
        .await
        .map_err(|e| e.to_string())??
    };
    eprintln!("[PERF] stage3 rasterize/cache B: {:.3}s  {}x{}", t2.elapsed().as_secs_f64(), rgba_b.width(), rgba_b.height());

    // 差分計算（rayon でピクセル並列処理）
    let t3 = std::time::Instant::now();
    let result = tokio::task::spawn_blocking(move || diff::diff(&rgba_a, &rgba_b))
        .await
        .map_err(|e| e.to_string())?;
    eprintln!("[PERF] stage4 diff+overlay: {:.3}s  change_type={:?}", t3.elapsed().as_secs_f64(), result.change_type);

    let change_type = match result.change_type {
        diff::ChangeType::None => "none",
        diff::ChangeType::Minor => "minor",
        diff::ChangeType::Meaningful => "meaningful",
    }
    .to_string();

    if result.change_type == diff::ChangeType::None {
        eprintln!("[PERF] total (no overlay): {:.3}s", t0.elapsed().as_secs_f64());
        return Ok(GenerateDiffResult {
            change_type,
            url: None,
        });
    }

    let t4 = std::time::Instant::now();
    let overlay = result.overlay.unwrap();
    let url = tokio::task::spawn_blocking(move || -> Result<String, String> {
        // flate2 + zlib-ng バックエンドで PNG エンコード（miniz_oxide の約 10 倍速）
        let png_bytes = png_encode_fast::encode(&overlay)?;
        eprintln!("[PERF] stage5 overlay PNG encode: {:.3}s  overlay_png={}KB",
            t4.elapsed().as_secs_f64(), png_bytes.len() / 1024);
        let t5 = std::time::Instant::now();
        let url = format!("data:image/png;base64,{}", STANDARD.encode(&png_bytes));
        eprintln!("[PERF] stage6 base64 encode: {:.3}s  url_len={}KB",
            t5.elapsed().as_secs_f64(), url.len() / 1024);
        Ok(url)
    })
    .await
    .map_err(|e| e.to_string())??;
    eprintln!("[PERF] total: {:.3}s", t0.elapsed().as_secs_f64());

    Ok(GenerateDiffResult {
        change_type,
        url: Some(url),
    })
}

#[tauri::command]
pub async fn get_pdf_image(
    filename: String,
    oid: String,
    size: Option<String>,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let path = require_repo_path(&state)?;
    let pool = get_pool_opt(&state);

    // git2 は !Send のためスコープ内で完結させる
    let (blob_oid, pdf_bytes) = {
        let repo = git2::Repository::open(&path).map_err(|e| e.to_string())?;
        extract_blob_with_oid(&repo, &oid, &filename)?
    };

    let full_png = if let Some(ref pool) = pool {
        image_cache::get_or_rasterize(pool, &pdf_bytes, &blob_oid, 0).await?
    } else {
        pdf::rasterize(&pdf_bytes, 0).map_err(|e| e.to_string())?
    };

    let result_png = if size.as_deref() == Some("thumb") {
        tokio::task::spawn_blocking(move || image_cache::resize_to_thumb(&full_png))
            .await
            .map_err(|e| e.to_string())??
    } else {
        full_png
    };

    Ok(format!(
        "data:image/png;base64,{}",
        STANDARD.encode(&result_png)
    ))
}

#[tauri::command]
pub async fn get_working_copy_image(
    filename: String,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let path = require_repo_path(&state)?;

    let pdf_bytes = std::fs::read(path.join(&filename)).map_err(|e| e.to_string())?;

    let png_bytes = tokio::task::spawn_blocking(move || {
        pdf::rasterize(&pdf_bytes, 0).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())??;

    Ok(format!(
        "data:image/png;base64,{}",
        STANDARD.encode(&png_bytes)
    ))
}
