use std::path::Path;
use std::sync::mpsc::Receiver;

pub enum WatchEvent {
    Created(String),
    Modified(String),
    Deleted(String),
}

pub fn watch(_path: &Path) -> Result<Receiver<WatchEvent>, Box<dyn std::error::Error>> {
    todo!()
}
