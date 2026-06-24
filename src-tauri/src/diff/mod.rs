use std::sync::atomic::{AtomicBool, Ordering::Relaxed};

use image::RgbaImage;
use rayon::prelude::*;

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
        let t = std::time::Instant::now();
        let threshold = self.threshold;
        let width = new.width();
        let height = new.height();

        let any_changed = AtomicBool::new(false);
        let any_meaningful = AtomicBool::new(false);

        // 1 パスで change 検知とオーバーレイ構築を同時実行
        let out_raw: Vec<u8> = old.as_raw()
            .par_chunks(4)
            .zip(new.as_raw().par_chunks(4))
            .flat_map_iter(|(old_px, new_px)| {
                let delta = old_px[0].abs_diff(new_px[0])
                    .max(old_px[1].abs_diff(new_px[1]))
                    .max(old_px[2].abs_diff(new_px[2]));
                if delta > threshold {
                    any_changed.store(true, Relaxed);
                    any_meaningful.store(true, Relaxed);
                    let old_lum = (old_px[0] as u32 * 299 + old_px[1] as u32 * 587 + old_px[2] as u32 * 114) / 1000;
                    let new_lum = (new_px[0] as u32 * 299 + new_px[1] as u32 * 587 + new_px[2] as u32 * 114) / 1000;
                    if old_lum > new_lum { [0u8, 0, 255, 255] } else { [255u8, 0, 0, 255] }
                } else {
                    if delta > 0 {
                        any_changed.store(true, Relaxed);
                    }
                    let lum = ((new_px[0] as u32 * 299 + new_px[1] as u32 * 587 + new_px[2] as u32 * 114) / 1000) as u8;
                    [lum, lum, lum, new_px[3]]
                }
            })
            .collect();

        eprintln!("[PERF]     single-pass diff+overlay (rayon): {:.3}s", t.elapsed().as_secs_f64());

        if !any_changed.load(Relaxed) {
            return DiffResult { change_type: ChangeType::None, overlay: None };
        }

        let change_type = if any_meaningful.load(Relaxed) { ChangeType::Meaningful } else { ChangeType::Minor };
        let overlay = RgbaImage::from_raw(width, height, out_raw).unwrap();
        DiffResult { change_type, overlay: Some(overlay) }
    }
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
        let old = solid(4, 4, 0, 0, 0);
        let new = solid(4, 4, 255, 255, 255);
        let result = diff(&old, &new);
        assert_eq!(result.change_type, ChangeType::Meaningful);
        let overlay = result.overlay.expect("overlay should be present");
        let px = overlay.get_pixel(0, 0);
        assert_eq!(px[0], 255, "red channel should be 255 (red pixel)");
        assert_eq!(px[2], 0,   "blue channel should be 0 (red pixel)");
    }

    #[test]
    fn white_to_black_returns_meaningful_with_blue_pixels() {
        let old = solid(4, 4, 255, 255, 255);
        let new = solid(4, 4, 0, 0, 0);
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
