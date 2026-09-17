-- D1 Schema for DrawDB Backend
CREATE TABLE IF NOT EXISTS gists (
  id TEXT PRIMARY KEY,
  description TEXT DEFAULT '',
  is_public INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS gist_files (
  gist_id TEXT NOT NULL,
  filename TEXT NOT NULL,
  content TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (gist_id, filename),
  FOREIGN KEY (gist_id) REFERENCES gists(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS gist_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  gist_id TEXT NOT NULL,
  sha TEXT NOT NULL,
  filename TEXT NOT NULL,
  content TEXT NOT NULL,
  committed_at TEXT NOT NULL,
  FOREIGN KEY (gist_id) REFERENCES gists(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_gist_files_gist_id ON gist_files(gist_id);
CREATE INDEX IF NOT EXISTS idx_gist_versions_gist_file ON gist_versions(gist_id, filename, committed_at DESC);
CREATE INDEX IF NOT EXISTS idx_gist_versions_sha ON gist_versions(gist_id, sha);
