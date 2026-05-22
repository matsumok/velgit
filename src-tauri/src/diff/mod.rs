use image::RgbaImage;

#[derive(Debug, PartialEq)]
pub enum ChangeType {
    None,
    Minor,
    Meaningful,
}

pub struct DiffResult {
    pub change_type: ChangeType,
    pub overlay: Option<RgbaImage>,
}

pub trait DiffAlgorithm {
    fn diff(&self, old: &RgbaImage, new: &RgbaImage) -> DiffResult;
}

pub struct ThresholdDiff {
    pub threshold: u8,
}

impl DiffAlgorithm for ThresholdDiff {
    fn diff(&self, old: &RgbaImage, new: &RgbaImage) -> DiffResult {
        let mut any_changed = false;
        let mut any_meaningful = false;

        for (o, n) in old.pixels().zip(new.pixels()) {
            let delta = channel_delta(o, n);
            if delta > 0 {
                any_changed = true;
            }
            if delta > self.threshold {
                any_meaningful = true;
                break;
            }
        }

        if !any_changed {
            return DiffResult { change_type: ChangeType::None, overlay: Option::None };
        }

        let change_type = if any_meaningful { ChangeType::Meaningful } else { ChangeType::Minor };
        let overlay = build_overlay(old, new, self.threshold);
        DiffResult { change_type, overlay: Some(overlay) }
    }
}

fn channel_delta(a: &image::Rgba<u8>, b: &image::Rgba<u8>) -> u8 {
    let dr = a[0].abs_diff(b[0]);
    let dg = a[1].abs_diff(b[1]);
    let db = a[2].abs_diff(b[2]);
    dr.max(dg).max(db)
}

fn build_overlay(old: &RgbaImage, new: &RgbaImage, threshold: u8) -> RgbaImage {
    let mut out = new.clone();
    for (x, y, new_px) in new.enumerate_pixels() {
        let old_px = old.get_pixel(x, y);
        if channel_delta(old_px, new_px) > threshold {
            let old_lum = luminance(old_px);
            let new_lum = luminance(new_px);
            let color = if old_lum > new_lum {
                image::Rgba([0u8, 0, 255, 255])    // blue: content added
            } else {
                image::Rgba([255u8, 0, 0, 255])    // red: content removed
            };
            out.put_pixel(x, y, color);
        }
    }
    out
}

fn luminance(px: &image::Rgba<u8>) -> u8 {
    let r = px[0] as u32;
    let g = px[1] as u32;
    let b = px[2] as u32;
    ((r * 299 + g * 587 + b * 114) / 1000) as u8
}

pub fn diff(old: &RgbaImage, new: &RgbaImage) -> DiffResult {
    ThresholdDiff { threshold: 10 }.diff(old, new)
}

#[cfg(test)]
mod tests {
    use super::*;
    use image::{Rgba, RgbaImage};

    fn solid(w: u32, h: u32, r: u8, g: u8, b: u8) -> RgbaImage {
        RgbaImage::from_pixel(w, h, Rgba([r, g, b, 255]))
    }

    #[test]
    fn pixel_delta_at_threshold_returns_minor() {
        // threshold=10, delta=10 → Minor (strictly > threshold が Meaningful)
        let old = solid(2, 2, 100, 100, 100);
        let new = solid(2, 2, 110, 110, 110); // delta = 10 = threshold → Minor
        let result = ThresholdDiff { threshold: 10 }.diff(&old, &new);
        assert_eq!(result.change_type, ChangeType::Minor);
        assert!(result.overlay.is_some());
    }

    #[test]
    fn pixel_delta_above_threshold_returns_meaningful() {
        let old = solid(2, 2, 100, 100, 100);
        let new = solid(2, 2, 111, 111, 111); // delta = 11 > threshold → Meaningful
        let result = ThresholdDiff { threshold: 10 }.diff(&old, &new);
        assert_eq!(result.change_type, ChangeType::Meaningful);
    }

    #[test]
    fn black_to_white_returns_meaningful_with_red_pixels() {
        let old = solid(4, 4, 0, 0, 0);       // 黒（コンテンツあり）
        let new = solid(4, 4, 255, 255, 255); // 白（コンテンツ消去）
        let result = diff(&old, &new);
        assert_eq!(result.change_type, ChangeType::Meaningful);
        let overlay = result.overlay.expect("overlay should be present");
        let px = overlay.get_pixel(0, 0);
        assert_eq!(px[0], 255, "red channel should be 255 (red pixel)");
        assert_eq!(px[2], 0,   "blue channel should be 0 (red pixel)");
    }

    #[test]
    fn white_to_black_returns_meaningful_with_blue_pixels() {
        let old = solid(4, 4, 255, 255, 255); // 白（コンテンツなし）
        let new = solid(4, 4, 0, 0, 0);       // 黒（コンテンツ追加）
        let result = diff(&old, &new);
        assert_eq!(result.change_type, ChangeType::Meaningful);
        let overlay = result.overlay.expect("overlay should be present");
        let px = overlay.get_pixel(0, 0);
        assert_eq!(px[0], 0,   "red channel should be 0 (blue pixel)");
        assert_eq!(px[2], 255, "blue channel should be 255 (blue pixel)");
    }

    #[test]
    fn identical_images_return_none() {
        let img = solid(4, 4, 255, 255, 255);
        let result = diff(&img, &img);
        assert_eq!(result.change_type, ChangeType::None);
        assert!(result.overlay.is_none());
    }
}
