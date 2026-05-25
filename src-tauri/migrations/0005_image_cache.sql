CREATE TABLE IF NOT EXISTS image_cache (
  blob_oid   TEXT    NOT NULL,
  page       INTEGER NOT NULL DEFAULT 0,
  png_data   BLOB    NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (blob_oid, page)
);
