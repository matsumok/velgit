use flate2::{write::ZlibEncoder, Compression};
use image::RgbaImage;
use rayon::prelude::*;
use std::io::Write;

fn write_chunk(out: &mut Vec<u8>, chunk_type: &[u8; 4], data: &[u8]) {
    out.extend_from_slice(&(data.len() as u32).to_be_bytes());
    out.extend_from_slice(chunk_type);
    out.extend_from_slice(data);
    let mut hasher = crc32fast::Hasher::new();
    hasher.update(chunk_type);
    hasher.update(data);
    out.extend_from_slice(&hasher.finalize().to_be_bytes());
}

/// RGBA8 画像を PNG にエンコードする。
/// flate2 + zlib-ng バックエンドを使い、miniz_oxide より高速に deflate する。
pub fn encode(img: &RgbaImage) -> Result<Vec<u8>, String> {
    let w = img.width();
    let h = img.height();
    let raw = img.as_raw();
    let row_bytes = (w * 4) as usize;

    // Sub フィルタを各行に rayon で並列適用してから deflate に渡す
    let mut filtered = vec![0u8; h as usize * (1 + row_bytes)];
    filtered
        .par_chunks_mut(1 + row_bytes)
        .enumerate()
        .for_each(|(y, chunk)| {
            chunk[0] = 1u8; // filter type: Sub
            let row = &raw[y * row_bytes..(y + 1) * row_bytes];
            for i in 0..row_bytes {
                let prev = if i < 4 { 0u8 } else { row[i - 4] };
                chunk[1 + i] = row[i].wrapping_sub(prev);
            }
        });

    // zlib-ng で圧縮（IDAT に使う zlib フォーマット）
    let mut zlib = ZlibEncoder::new(Vec::new(), Compression::fast());
    zlib.write_all(&filtered).map_err(|e| e.to_string())?;
    let compressed = zlib.finish().map_err(|e| e.to_string())?;

    let mut out = Vec::with_capacity(8 + 25 + 12 + compressed.len() + 12);

    // PNG シグネチャ
    out.extend_from_slice(b"\x89PNG\r\n\x1a\n");

    // IHDR: width, height, bit_depth=8, color_type=6(RGBA), compress=0, filter=0, interlace=0
    let mut ihdr = [0u8; 13];
    ihdr[0..4].copy_from_slice(&w.to_be_bytes());
    ihdr[4..8].copy_from_slice(&h.to_be_bytes());
    ihdr[8] = 8; // bit depth
    ihdr[9] = 6; // color type: RGBA
    write_chunk(&mut out, b"IHDR", &ihdr);

    // IDAT
    write_chunk(&mut out, b"IDAT", &compressed);

    // IEND
    write_chunk(&mut out, b"IEND", &[]);

    Ok(out)
}
