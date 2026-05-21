use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::{Duration, SystemTime};

use notify::{Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use serde::Serialize;
use tauri::Emitter;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum WatcherState {
    Native,
    PollingFallback,
}

pub struct FileWatcher {
    _watcher: Option<RecommendedWatcher>,
    _stop: Arc<AtomicBool>,
}

impl Drop for FileWatcher {
    fn drop(&mut self) {
        self._stop.store(true, Ordering::Relaxed);
    }
}

impl FileWatcher {
    pub fn new(path: &Path, app_handle: tauri::AppHandle) -> Self {
        let stop = Arc::new(AtomicBool::new(false));
        let (tx, rx) = std::sync::mpsc::channel::<Result<Event, notify::Error>>();

        match RecommendedWatcher::new(tx, notify::Config::default()).and_then(|mut w| {
            w.watch(path, RecursiveMode::NonRecursive)?;
            Ok(w)
        }) {
            Ok(watcher) => {
                let _ = app_handle.emit("watcher-state-changed", WatcherState::Native);
                let handle = app_handle.clone();
                std::thread::spawn(move || {
                    for event in rx {
                        if let Ok(ev) = event {
                            if is_pdf_event(&ev) {
                                let _ = handle.emit("pdf-changed", ());
                            }
                        }
                    }
                });
                FileWatcher {
                    _watcher: Some(watcher),
                    _stop: stop,
                }
            }
            Err(_) => {
                let _ = app_handle.emit("watcher-state-changed", WatcherState::PollingFallback);
                let path_buf = path.to_path_buf();
                let handle = app_handle.clone();
                let stop_clone = stop.clone();
                std::thread::spawn(move || poll_loop(&path_buf, &handle, stop_clone));
                FileWatcher {
                    _watcher: None,
                    _stop: stop,
                }
            }
        }
    }
}

const POLL_SECS: u64 = 3;

fn poll_loop(path: &PathBuf, app_handle: &tauri::AppHandle, stop: Arc<AtomicBool>) {
    let mut snapshot = take_snapshot(path);
    loop {
        std::thread::sleep(Duration::from_secs(POLL_SECS));
        if stop.load(Ordering::Relaxed) {
            break;
        }
        let new_snapshot = take_snapshot(path);
        if new_snapshot != snapshot {
            let _ = app_handle.emit("pdf-changed", ());
        }
        snapshot = new_snapshot;
    }
}

type Snapshot = HashMap<PathBuf, Option<SystemTime>>;

fn take_snapshot(path: &PathBuf) -> Snapshot {
    let Ok(entries) = std::fs::read_dir(path) else {
        return HashMap::new();
    };
    entries
        .filter_map(|e| e.ok())
        .filter(|e| {
            e.path()
                .extension()
                .and_then(|s| s.to_str())
                .map(|s| s.to_lowercase() == "pdf")
                .unwrap_or(false)
        })
        .map(|e| {
            let mtime = e.metadata().ok().and_then(|m| m.modified().ok());
            (e.path(), mtime)
        })
        .collect()
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
