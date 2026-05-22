PRAGMA foreign_keys = OFF;

CREATE TABLE release_drawings_new (
  release_id INTEGER NOT NULL REFERENCES releases(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  PRIMARY KEY (release_id, filename)
);

INSERT INTO release_drawings_new SELECT * FROM release_drawings;

DROP TABLE release_drawings;

ALTER TABLE release_drawings_new RENAME TO release_drawings;

PRAGMA foreign_keys = ON;
