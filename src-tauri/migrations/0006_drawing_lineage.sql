CREATE TABLE IF NOT EXISTS drawing_lineage (
    successor_filename   TEXT NOT NULL,
    predecessor_filename TEXT NOT NULL,
    linked_at_commit_oid TEXT NOT NULL,
    PRIMARY KEY (successor_filename)
);
