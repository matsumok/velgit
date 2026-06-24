use pdfium_render::prelude::*;

fn load_pdfium() -> Result<Pdfium, PdfiumError> {
    Pdfium::bind_to_library(Pdfium::pdfium_platform_library_name_at_path("./"))
        .or_else(|_| Pdfium::bind_to_system_library())
        .map(Pdfium::new)
}

pub fn bind_from_commit(
    repo: &git2::Repository,
    commit_oid: &str,
    filenames: &[String],
) -> Result<Vec<u8>, String> {
    let oid = git2::Oid::from_str(commit_oid).map_err(|e| e.to_string())?;
    let commit = repo.find_commit(oid).map_err(|e| e.to_string())?;
    let tree = commit.tree().map_err(|e| e.to_string())?;

    let mut pdf_bytes_list: Vec<Vec<u8>> = Vec::new();
    for filename in filenames {
        let entry = tree
            .get_name(filename)
            .ok_or_else(|| format!("{filename} はこのコミットに存在しません"))?;
        let blob = repo.find_blob(entry.id()).map_err(|e| e.to_string())?;
        pdf_bytes_list.push(blob.content().to_vec());
    }

    bind(&pdf_bytes_list).map_err(|e| e.to_string())
}

pub fn bind(pdf_bytes_list: &[Vec<u8>]) -> Result<Vec<u8>, Box<dyn std::error::Error>> {
    let pdfium = load_pdfium()?;
    let mut dest = pdfium.create_new_pdf()?;
    for bytes in pdf_bytes_list {
        let mut src = pdfium.load_pdf_from_byte_slice(bytes, None)?;
        let src_count = src.pages().len();
        for i in 0..src_count {
            let insert_at = dest.pages().len();
            dest.pages_mut().copy_page_from_document(&mut src, i, insert_at)?;
        }
    }
    Ok(dest.save_to_bytes()?)
}

pub fn zip_from_commit(
    repo: &git2::Repository,
    commit_oid: &str,
    filenames: &[String],
) -> Result<Vec<u8>, String> {
    use std::io::{Cursor, Write};
    use zip::write::SimpleFileOptions;

    let oid = git2::Oid::from_str(commit_oid).map_err(|e| e.to_string())?;
    let commit = repo.find_commit(oid).map_err(|e| e.to_string())?;
    let tree = commit.tree().map_err(|e| e.to_string())?;

    let buf = Cursor::new(Vec::new());
    let mut writer = zip::ZipWriter::new(buf);
    let options = SimpleFileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated);

    for filename in filenames {
        let entry = tree
            .get_name(filename)
            .ok_or_else(|| format!("{filename} はこのコミットに存在しません"))?;
        let blob = repo.find_blob(entry.id()).map_err(|e| e.to_string())?;
        writer.start_file(filename, options).map_err(|e| e.to_string())?;
        writer.write_all(blob.content()).map_err(|e| e.to_string())?;
    }

    let cursor = writer.finish().map_err(|e| e.to_string())?;
    Ok(cursor.into_inner())
}

pub fn rasterize_to_image(data: &[u8], page: u32) -> Result<image::RgbaImage, Box<dyn std::error::Error>> {
    let pdfium = load_pdfium()?;
    let doc = pdfium.load_pdf_from_byte_slice(data, None)?;
    let page = doc.pages().get(page as u16)?;
    // A3 @ 350 DPI: 420mm×350/25.4≈5787px, 297mm×350/25.4≈4093px
    let config = PdfRenderConfig::new()
        .set_target_width(5787)
        .set_maximum_height(5787);
    let bitmap = page.render_with_config(&config)?;
    let img = bitmap.as_image().into_rgba8();
    Ok(img)
}

pub fn rasterize(data: &[u8], page: u32) -> Result<Vec<u8>, Box<dyn std::error::Error>> {
    let img = rasterize_to_image(data, page)?;
    let mut out = Vec::new();
    img.write_to(&mut std::io::Cursor::new(&mut out), image::ImageFormat::Png)?;
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;

    // Minimal valid PDF 1.4 with one empty A4 page
    const MINIMAL_PDF: &[u8] = b"%PDF-1.4\n\
        1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n\
        2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n\
        3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] >>\nendobj\n\
        xref\n0 4\n\
        0000000000 65535 f \n\
        0000000009 00000 n \n\
        0000000058 00000 n \n\
        0000000115 00000 n \n\
        trailer\n<< /Size 4 /Root 1 0 R >>\n\
        startxref\n190\n%%EOF";

    #[test]
    fn bind_returns_valid_pdf_bytes() {
        let result = bind(&[MINIMAL_PDF.to_vec(), MINIMAL_PDF.to_vec()]);
        assert!(result.is_ok(), "bind failed: {:?}", result.err());
        let bytes = result.unwrap();
        assert!(!bytes.is_empty());
        assert!(bytes.starts_with(b"%PDF"), "output is not PDF");
    }

    #[test]
    fn rasterize_returns_error_for_invalid_data() {
        let result = rasterize(b"this is not a pdf", 0);
        assert!(result.is_err());
    }

    #[test]
    fn rasterize_returns_png_bytes_for_valid_pdf() {
        let result = rasterize(MINIMAL_PDF, 0);
        assert!(result.is_ok(), "rasterize failed: {:?}", result.err());
        let bytes = result.unwrap();
        assert!(!bytes.is_empty());
        // PNG magic bytes: \x89PNG
        assert_eq!(&bytes[..4], b"\x89PNG", "output is not PNG");
    }
}
