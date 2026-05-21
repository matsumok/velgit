use std::path::Path;

use sqlx::SqlitePool;

pub struct DbPool(SqlitePool);

impl DbPool {
    pub async fn open(_path: &Path) -> Result<Self, sqlx::Error> {
        todo!()
    }
}
