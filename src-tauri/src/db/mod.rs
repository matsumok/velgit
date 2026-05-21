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
        sqlx::migrate!("./migrations")
            .set_locking(false)
            .run(&pool)
            .await?;
        Ok(DbPool(pool))
    }

    pub async fn insert_drawings(&self, filenames: &[String]) -> Result<(), sqlx::Error> {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs() as i64;
        for filename in filenames {
            sqlx::query(
                "INSERT OR IGNORE INTO drawings (filename, added_at) VALUES (?, ?)",
            )
            .bind(filename)
            .bind(now)
            .execute(&self.0)
            .await?;
        }
        Ok(())
    }

    pub async fn list_drawings(&self) -> Result<Vec<(String, i64)>, sqlx::Error> {
        let rows = sqlx::query_as::<_, (String, i64)>(
            "SELECT filename, added_at FROM drawings ORDER BY filename",
        )
        .fetch_all(&self.0)
        .await?;
        Ok(rows)
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
    async fn insert_drawings_is_idempotent() {
        let dir = tempdir().unwrap();
        let pool = DbPool::open(&dir.path().join("velgit.db")).await.unwrap();
        let filenames = vec!["A-001_平面図.pdf".to_string()];

        pool.insert_drawings(&filenames).await.unwrap();
        pool.insert_drawings(&filenames).await.unwrap(); // 2回目もエラーにならない

        let drawings = pool.list_drawings().await.unwrap();
        assert_eq!(drawings.len(), 1); // 重複なし
    }

    #[tokio::test]
    async fn list_drawings_returns_inserted() {
        let dir = tempdir().unwrap();
        let pool = DbPool::open(&dir.path().join("velgit.db")).await.unwrap();
        let filenames = vec!["A-001_平面図.pdf".to_string()];
        pool.insert_drawings(&filenames).await.unwrap();

        let drawings = pool.list_drawings().await.unwrap();

        assert_eq!(drawings.len(), 1);
        assert_eq!(drawings[0].0, "A-001_平面図.pdf");
    }

    #[tokio::test]
    async fn insert_drawings_stores_in_db() {
        let dir = tempdir().unwrap();
        let pool = DbPool::open(&dir.path().join("velgit.db")).await.unwrap();
        let filenames = vec!["A-001_平面図.pdf".to_string(), "S-001_伏図.pdf".to_string()];

        pool.insert_drawings(&filenames).await.unwrap();

        let row: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM drawings")
            .fetch_one(&pool.0)
            .await
            .unwrap();
        assert_eq!(row.0, 2);
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
