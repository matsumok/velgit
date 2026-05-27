use sqlx::SqlitePool;

/// blob OID をキーに PNG をキャッシュする。
pub async fn get_or_rasterize(
    pool: &SqlitePool,
    pdf_bytes: &[u8],
    blob_oid: &str,
    page: u32,
) -> Result<Vec<u8>, String> {
    let cached: Option<(Vec<u8>,)> = sqlx::query_as(
        "SELECT png_data FROM image_cache WHERE blob_oid = ? AND page = ?",
    )
    .bind(blob_oid)
    .bind(page as i64)
    .fetch_optional(pool)
    .await
    .map_err(|e| e.to_string())?;

    if let Some((png,)) = cached {
        eprintln!("[CACHE] HIT  blob_oid={} png={}KB", &blob_oid[..8], png.len() / 1024);
        return Ok(png);
    }
    eprintln!("[CACHE] MISS blob_oid={} — rasterizing...", &blob_oid[..8]);

    let pdf_owned = pdf_bytes.to_vec();
    let png = tokio::task::spawn_blocking(move || {
        crate::pdf::rasterize(&pdf_owned, page).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
    ?;

    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64;
    let _ = sqlx::query(
        "INSERT OR IGNORE INTO image_cache (blob_oid, page, png_data, created_at) VALUES (?, ?, ?, ?)",
    )
    .bind(blob_oid)
    .bind(page as i64)
    .bind(&png)
    .bind(now)
    .execute(pool)
    .await;

    Ok(png)
}

pub fn decode_to_rgba(png: &[u8]) -> Result<image::RgbaImage, String> {
    image::load_from_memory(png)
        .map(|i| i.into_rgba8())
        .map_err(|e| e.to_string())
}

pub fn resize_to_thumb(png: &[u8]) -> Result<Vec<u8>, String> {
    let img = image::load_from_memory(png).map_err(|e| e.to_string())?;
    let thumb = img.resize(400, 600, image::imageops::FilterType::Triangle);
    let mut out = Vec::new();
    thumb
        .write_to(&mut std::io::Cursor::new(&mut out), image::ImageFormat::Png)
        .map_err(|e| e.to_string())?;
    Ok(out)
}
