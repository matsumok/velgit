use std::path::Path;

use notify::{Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use tauri::Emitter;

pub struct FileWatcher {
    _watcher: RecommendedWatcher,
}

impl FileWatcher {
    pub fn new(path: &Path, app_handle: tauri::AppHandle) -> Result<Self, notify::Error> {
        let (tx, rx) = std::sync::mpsc::channel::<Result<Event, notify::Error>>();
        let mut watcher = RecommendedWatcher::new(tx, notify::Config::default())?;
        watcher.watch(path, RecursiveMode::NonRecursive)?;

        std::thread::spawn(move || {
            for event in rx {
                if let Ok(ev) = event {
                    if is_pdf_event(&ev) {
                        let _ = app_handle.emit("pdf-changed", ());
                    }
                }
            }
        });

        Ok(FileWatcher { _watcher: watcher })
    }
}

fn is_pdf_event(event: &Event) -> bool {
    matches!(
        event.kind,
        EventKind::Create(_) | EventKind::Modify(_) | EventKind::Remove(_)
    ) && event.paths.iter().any(|p| {
        p.extension()
            .and_then(|e| e.to_str())
            .map(|e| e.to_lowercase() == "pdf")
            .unwrap_or(false)
    })
}
