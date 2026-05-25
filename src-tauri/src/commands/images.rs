use base64::{engine::general_purpose::STANDARD, Engine as _};
use tauri::State;

use crate::{diff, image_cache, pdf, AppState};

use super::{extract_blob_with_oid, get_pool_opt, require_repo_path, GenerateDiffResult};

#[tauri::command]
pub async fn generate_diff(
    filename: String,
    oid_a: String,
    oid_b: Option<String>,
    state: State<'_, AppState>,
) -> Result<GenerateDiffResult, String> {
    let path = require_repo_path(&state)?;
    let pool = get_pool_opt(&state);

    // git2 は !Send のためスコープ内で完結させる
    let (blob_oid_a, pdf_a, blob_oid_b, pdf_b) = {
        let repo = git2::Repository::open(&path).map_err(|e| e.to_string())?;
        let (blob_oid_a, pdf_a) = extract_blob_with_oid(&repo, &oid_a, &filename)?;

        match oid_b {
            Some(ref oid_b_str) => {
                let (blob_oid_b, pdf_b) =
                    extract_blob_with_oid(&repo, oid_b_str, &filename)?;
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
        }
    };

    // blob_a: キャッシュ経由でラスタライズ
    let png_a = if let Some(ref pool) = pool {
        image_cache::get_or_rasterize(pool, &pdf_a, &blob_oid_a, 0).await?
    } else {
        pdf::rasterize(&pdf_a, 0).map_err(|e| e.to_string())?
    };

    // blob_b: コミット済みならキャッシュ経由、作業コピーは都度ラスタライズ
    let png_b = if let (Some(ref pool), Some(ref b_oid)) = (&pool, &blob_oid_b) {
        image_cache::get_or_rasterize(pool, &pdf_b, b_oid, 0).await?
    } else {
        tokio::task::spawn_blocking(move || {
            pdf::rasterize(&pdf_b, 0).map_err(|e| e.to_string())
        })
        .await
        .map_err(|e| e.to_string())??
    };

    // PNG → RGBA デコードと差分計算（CPU 重い処理をブロッキングスレッドで実行）
    let result = tokio::task::spawn_blocking(move || -> Result<diff::DiffResult, String> {
        let rgba_a = image_cache::decode_to_rgba(&png_a)?;
        let rgba_b = image_cache::decode_to_rgba(&png_b)?;
        Ok(diff::diff(&rgba_a, &rgba_b))
    })
    .await
    .map_err(|e| e.to_string())??;

    let change_type = match result.change_type {
        diff::ChangeType::None => "none",
        diff::ChangeType::Minor => "minor",
        diff::ChangeType::Meaningful => "meaningful",
    }
    .to_string();

    if result.change_type == diff::ChangeType::None {
        return Ok(GenerateDiffResult {
            change_type,
            url: None,
        });
    }

    let overlay = result.overlay.unwrap();
    let mut png_bytes = Vec::new();
    overlay
        .write_to(
            &mut std::io::Cursor::new(&mut png_bytes),
            image::ImageFormat::Png,
        )
        .map_err(|e| e.to_string())?;

    let url = format!("data:image/png;base64,{}", STANDARD.encode(&png_bytes));
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
