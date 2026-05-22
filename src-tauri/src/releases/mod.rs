use sqlx::SqlitePool;

#[derive(Debug, PartialEq)]
pub struct ReleaseEntry {
    pub id: i64,
    pub name: String,
    pub kind: String,
    pub recipient: Option<String>,
    pub commit_oid: String,
    pub created_at: i64,
    pub created_by: String,
}

pub async fn create(
    pool: &SqlitePool,
    name: &str,
    kind: &str,
    recipient: Option<&str>,
    drawing_filenames: &[String],
    commit_oid: &str,
    created_by: &str,
) -> Result<i64, sqlx::Error> {
    if drawing_filenames.is_empty() {
        return Err(sqlx::Error::Protocol("drawing_filenames must not be empty".into()));
    }
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64;
    let id = sqlx::query(
        "INSERT INTO releases (name, kind, recipient, commit_oid, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .bind(name)
    .bind(kind)
    .bind(recipient)
    .bind(commit_oid)
    .bind(now)
    .bind(created_by)
    .execute(pool)
    .await?
    .last_insert_rowid();

    for filename in drawing_filenames {
        sqlx::query(
            "INSERT INTO release_drawings (release_id, filename) VALUES (?, ?)",
        )
        .bind(id)
        .bind(filename)
        .execute(pool)
        .await?;
    }

    Ok(id)
}

pub async fn list(pool: &SqlitePool) -> Result<Vec<ReleaseEntry>, sqlx::Error> {
    let rows = sqlx::query_as::<_, (i64, String, String, Option<String>, String, i64, String)>(
        "SELECT id, name, kind, recipient, commit_oid, created_at, created_by FROM releases ORDER BY created_at DESC, id DESC",
    )
    .fetch_all(pool)
    .await?;
    Ok(rows
        .into_iter()
        .map(|(id, name, kind, recipient, commit_oid, created_at, created_by)| ReleaseEntry {
            id,
            name,
            kind,
            recipient,
            commit_oid,
            created_at,
            created_by,
        })
        .collect())
}

pub async fn get_drawings(pool: &SqlitePool, id: i64) -> Result<Vec<String>, sqlx::Error> {
    let rows = sqlx::query_as::<_, (String,)>(
        "SELECT filename FROM release_drawings WHERE release_id = ? ORDER BY filename",
    )
    .bind(id)
    .fetch_all(pool)
    .await?;
    Ok(rows.into_iter().map(|(f,)| f).collect())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::DbPool;
    use tempfile::tempdir;

    async fn open_db(dir: &std::path::Path) -> SqlitePool {
        DbPool::open(&dir.join("velgit.db")).await.unwrap().0
    }

    #[tokio::test]
    async fn get_drawings_returns_filenames_for_release() {
        let dir = tempdir().unwrap();
        let pool = open_db(dir.path()).await;
        let filenames = vec!["A-001_平面図.pdf".to_string(), "S-001_伏図.pdf".to_string()];

        let id = create(&pool, "第1回", "internal", None, &filenames, "abc", "user").await.unwrap();
        let result = get_drawings(&pool, id).await.unwrap();

        assert_eq!(result.len(), 2);
        assert!(result.contains(&"A-001_平面図.pdf".to_string()));
        assert!(result.contains(&"S-001_伏図.pdf".to_string()));
    }

    #[tokio::test]
    async fn create_with_empty_filenames_returns_error() {
        let dir = tempdir().unwrap();
        let pool = open_db(dir.path()).await;

        let result = create(&pool, "第1回", "internal", None, &[], "abc123", "山田太郎").await;

        assert!(result.is_err());
    }

    #[tokio::test]
    async fn list_returns_entries_in_desc_order() {
        let dir = tempdir().unwrap();
        let pool = open_db(dir.path()).await;

        create(&pool, "第1回", "internal", None, &["A.pdf".to_string()], "aaa", "user-a").await.unwrap();
        create(&pool, "第2回", "external", Some("〇〇建設"), &["B.pdf".to_string()], "bbb", "user-b").await.unwrap();

        let entries = list(&pool).await.unwrap();

        assert_eq!(entries.len(), 2);
        assert_eq!(entries[0].name, "第2回");
        assert_eq!(entries[1].name, "第1回");
    }

    #[tokio::test]
    async fn create_inserts_release_and_returns_id() {
        let dir = tempdir().unwrap();
        let pool = open_db(dir.path()).await;

        let id = create(
            &pool,
            "実施設計第1回",
            "internal",
            None,
            &["A-001_平面図.pdf".to_string()],
            "abc123",
            "山田太郎",
        )
        .await
        .unwrap();

        assert!(id > 0);
        let count: (i64,) =
            sqlx::query_as("SELECT COUNT(*) FROM releases WHERE id = ?")
                .bind(id)
                .fetch_one(&pool)
                .await
                .unwrap();
        assert_eq!(count.0, 1);
    }
}
