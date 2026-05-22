CREATE TABLE IF NOT EXISTS commit_files (
  commit_oid TEXT NOT NULL,
  filename TEXT NOT NULL,
  change_type TEXT NOT NULL,
  change_type_overridden INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (commit_oid, filename)
);
