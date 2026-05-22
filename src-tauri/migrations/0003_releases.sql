CREATE TABLE IF NOT EXISTS releases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('internal', 'external')),
  recipient TEXT,
  commit_oid TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  created_by TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS release_drawings (
  release_id INTEGER NOT NULL REFERENCES releases(id),
  filename TEXT NOT NULL,
  PRIMARY KEY (release_id, filename)
);
