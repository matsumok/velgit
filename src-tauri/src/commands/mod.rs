use serde::{Deserialize, Serialize};
use tauri::State;

use crate::AppState;

#[derive(Debug, Serialize, Deserialize)]
pub struct DrawingDto {
    pub filename: String,
    pub added_at: i64,
}

#[tauri::command]
pub async fn get_drawings(_state: State<'_, AppState>) -> Result<Vec<DrawingDto>, String> {
    todo!()
}
