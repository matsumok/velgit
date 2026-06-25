use base64::{engine::general_purpose::STANDARD, Engine as _};
use tauri::State;

use crate::{diff, image_cache, pdf, png_encode_fast, AppState};

use super::{get_pool_opt, require_repo_path, resolve_blob_opt, GenerateDiffResult};

#[tauri::command]
pub async fn generate_diff(
    filename: String,
    oid_a: String,
    oid_b: Option<String>,
    state: State<'_, AppState>,
) -> Result<GenerateDiffResult, String> {
    let path = require_repo_path(&state)?;
    let pool = get_pool_opt(&state);

    let (blob_oid_a, pdf_a, blob_oid_b, pdf_b) = match oid_b {
        Some(ref oid_b_str) => {
            let (blob_oid_a, pdf_a) =
                resolve_blob_opt(&path, &oid_a, &filename, pool.as_ref()).await?;
            let (blob_oid_b, pdf_b) =
                resolve_blob_opt(&path, oid_b_str, &filename, pool.as_ref()).await?;
            if blob_oid_a == blob_oid_b {
                return Ok(GenerateDiffResult {
                    change_type: "none".to_string(),
                    url: None,
                });
            }
            (blob_oid_a, pdf_a, Some(blob_oid_b), pdf_b)
        }
        None => {
            let (blob_oid_a, pdf_a) =
                resolve_blob_opt(&path, &oid_a, &filename, pool.as_ref()).await?;
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

    let rgba_a = if let Some(ref pool) = pool {
        let png = image_cache::get_or_rasterize(pool, &pdf_a, &blob_oid_a, 0).await?;
        tokio::task::spawn_blocking(move || image_cache::decode_to_rgba(&png))
            .await
            .map_err(|e| e.to_string())??
    } else {
        pdf::rasterize_to_image(&pdf_a, 0).map_err(|e| e.to_string())?
    };

    let rgba_b = if let (Some(ref pool), Some(ref b_oid)) = (&pool, &blob_oid_b) {
        let png = image_cache::get_or_rasterize(pool, &pdf_b, b_oid, 0).await?;
        tokio::task::spawn_blocking(move || image_cache::decode_to_rgba(&png))
            .await
            .map_err(|e| e.to_string())??
    } else {
        tokio::task::spawn_blocking(move || {
            pdf::rasterize_to_image(&pdf_b, 0).map_err(|e| e.to_string())
        })
        .await
        .map_err(|e| e.to_string())??
    };

    let result = tokio::task::spawn_blocking(move || diff::diff(&rgba_a, &rgba_b))
        .await
        .map_err(|e| e.to_string())?;

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
    let url = tokio::task::spawn_blocking(move || -> Result<String, String> {
        let png_bytes = png_encode_fast::encode(&overlay)?;
        Ok(format!("data:image/png;base64,{}", STANDARD.encode(&png_bytes)))
    })
    .await
    .map_err(|e| e.to_string())??;

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

    let (blob_oid, pdf_bytes) =
        resolve_blob_opt(&path, &oid, &filename, pool.as_ref()).await?;

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
