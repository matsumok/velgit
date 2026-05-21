CREATE TABLE IF NOT EXISTS drawings (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    repo_path TEXT NOT NULL,
    created_at INTEGER NOT NULL
);
