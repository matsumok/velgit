use std::path::Path;

use sqlx::{
    sqlite::{SqliteConnectOptions, SqlitePoolOptions},
    SqlitePool,
};

pub struct DbPool(pub SqlitePool);

impl DbPool {
    pub async fn open(path: &Path) -> Result<Self, sqlx::Error> {
        let opts = SqliteConnectOptions::new()
            .filename(path)
            .create_if_missing(true);
        let pool = SqlitePoolOptions::new()
            .max_connections(1)
            .connect_with(opts)
            .await?;
        Self::apply_schema(&pool).await?;
        Ok(DbPool(pool))
    }

    async fn apply_schema(pool: &SqlitePool) -> Result<(), sqlx::Error> {
        sqlx::query(
            "CREATE TABLE IF NOT EXISTS drawings (
                filename TEXT PRIMARY KEY NOT NULL,
                added_at  INTEGER NOT NULL
            )",
        )
        .execute(pool)
        .await?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[tokio::test]
    async fn open_creates_db_file() {
        let dir = tempdir().unwrap();
        let db_path = dir.path().join("velgit.db");
        DbPool::open(&db_path).await.unwrap();
        assert!(db_path.exists());
    }

    #[tokio::test]
    async fn open_creates_drawings_table() {
        let dir = tempdir().unwrap();
        let db_path = dir.path().join("velgit.db");
        let pool = DbPool::open(&db_path).await.unwrap();
        let row: (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='drawings'",
        )
        .fetch_one(&pool.0)
        .await
        .unwrap();
        assert_eq!(row.0, 1);
    }
}
