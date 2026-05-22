use std::path::Path;

use sqlx::{
    sqlite::{SqliteConnectOptions, SqlitePoolOptions},
    SqlitePool,
};

pub struct DbPool(pub SqlitePool);

pub struct CommitFileRecord {
    pub filename: String,
    pub change_type: String,
    pub overridden: bool,
}

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

    pub async fn insert_commit_files(
        &self,
        commit_oid: &str,
        files: &[CommitFileRecord],
    ) -> Result<(), sqlx::Error> {
        for f in files {
            sqlx::query(
                "INSERT OR IGNORE INTO commit_files (commit_oid, filename, change_type, change_type_overridden) VALUES (?, ?, ?, ?)",
            )
            .bind(commit_oid)
            .bind(&f.filename)
            .bind(&f.change_type)
            .bind(f.overridden as i32)
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

    #[tokio::test]
    async fn insert_commit_files_stores_records() {
        let dir = tempdir().unwrap();
        let pool = DbPool::open(&dir.path().join("velgit.db")).await.unwrap();

        let files = vec![
            CommitFileRecord { filename: "A-001.pdf".to_string(), change_type: "meaningful".to_string(), overridden: false },
            CommitFileRecord { filename: "S-001.pdf".to_string(), change_type: "minor".to_string(), overridden: false },
        ];
        pool.insert_commit_files("abc123", &files).await.unwrap();

        let row: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM commit_files WHERE commit_oid = 'abc123'")
            .fetch_one(&pool.0).await.unwrap();
        assert_eq!(row.0, 2);
    }

    #[tokio::test]
    async fn insert_commit_files_records_override_flag() {
        let dir = tempdir().unwrap();
        let pool = DbPool::open(&dir.path().join("velgit.db")).await.unwrap();

        let files = vec![
            CommitFileRecord { filename: "A-001.pdf".to_string(), change_type: "meaningful".to_string(), overridden: true },
        ];
        pool.insert_commit_files("abc123", &files).await.unwrap();

        let row: (i64,) = sqlx::query_as(
            "SELECT change_type_overridden FROM commit_files WHERE commit_oid = 'abc123' AND filename = 'A-001.pdf'",
        )
        .fetch_one(&pool.0).await.unwrap();
        assert_eq!(row.0, 1);
    }

    #[tokio::test]
    async fn open_creates_commit_files_table() {
        let dir = tempdir().unwrap();
        let db_path = dir.path().join("velgit.db");
        let pool = DbPool::open(&db_path).await.unwrap();
        let row: (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='commit_files'",
        )
        .fetch_one(&pool.0)
        .await
        .unwrap();
        assert_eq!(row.0, 1);
    }

    #[tokio::test]
    async fn open_creates_releases_table() {
        let dir = tempdir().unwrap();
        let db_path = dir.path().join("velgit.db");
        let pool = DbPool::open(&db_path).await.unwrap();
        let row: (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='releases'",
        )
        .fetch_one(&pool.0)
        .await
        .unwrap();
        assert_eq!(row.0, 1);
    }

    #[tokio::test]
    async fn open_creates_release_drawings_table() {
        let dir = tempdir().unwrap();
        let db_path = dir.path().join("velgit.db");
        let pool = DbPool::open(&db_path).await.unwrap();
        let row: (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='release_drawings'",
        )
        .fetch_one(&pool.0)
        .await
        .unwrap();
        assert_eq!(row.0, 1);
    }
}
