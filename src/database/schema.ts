import * as SQLite from 'expo-sqlite';

export const DATABASE_NAME = 'vlog.db';

// `type`/enum-like text columns intentionally have no CHECK constraint so new
// values (event types, ai job types, etc.) are additive with zero migration —
// see architecture doc v4.1 §1.8. Validation happens at the TS layer only.
const CREATE_STATEMENTS = `
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL,
  date TEXT NOT NULL,
  status TEXT NOT NULL,
  settings_json TEXT NOT NULL,
  cover_image_uri TEXT,
  latest_version_id TEXT,
  published_version_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tracks (
  id TEXT PRIMARY KEY NOT NULL,
  project_id TEXT NOT NULL,
  type TEXT NOT NULL,
  order_index INTEGER NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tracks_project ON tracks(project_id);

CREATE TABLE IF NOT EXISTS assets (
  id TEXT PRIMARY KEY NOT NULL,
  project_id TEXT NOT NULL,
  media_type TEXT NOT NULL,
  local_uri TEXT NOT NULL,
  remote_uri TEXT,
  duration REAL NOT NULL,
  fps REAL NOT NULL,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  thumbnail_uri TEXT NOT NULL,
  poster_frame_uri TEXT NOT NULL,
  sync_status TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_assets_project ON assets(project_id);

CREATE TABLE IF NOT EXISTS clips (
  id TEXT PRIMARY KEY NOT NULL,
  project_id TEXT NOT NULL,
  track_id TEXT NOT NULL,
  asset_id TEXT NOT NULL,
  order_index INTEGER NOT NULL,
  trim_start REAL NOT NULL,
  trim_end REAL NOT NULL,
  effects_json TEXT NOT NULL,
  rotation REAL NOT NULL,
  crop_json TEXT,
  transform_json TEXT,
  visibility TEXT NOT NULL,
  deleted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_clips_project_track_order ON clips(project_id, track_id, order_index);
CREATE INDEX IF NOT EXISTS idx_clips_asset ON clips(asset_id);

CREATE TABLE IF NOT EXISTS export_versions (
  id TEXT PRIMARY KEY NOT NULL,
  project_id TEXT NOT NULL,
  version_number INTEGER NOT NULL,
  local_uri TEXT,
  remote_uri TEXT,
  thumbnail_uri TEXT,
  status TEXT NOT NULL,
  composition_snapshot_json TEXT NOT NULL,
  settings_snapshot_json TEXT NOT NULL,
  sync_status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  completed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_export_versions_project ON export_versions(project_id);

CREATE TABLE IF NOT EXISTS sync_queue (
  task_id TEXT PRIMARY KEY NOT NULL,
  project_id TEXT NOT NULL,
  target_id TEXT NOT NULL,
  type TEXT NOT NULL,
  status TEXT NOT NULL,
  priority INTEGER NOT NULL,
  retry_count INTEGER NOT NULL,
  last_error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sync_queue_status_priority ON sync_queue(status, priority);

CREATE TABLE IF NOT EXISTS ai_jobs (
  id TEXT PRIMARY KEY NOT NULL,
  project_id TEXT NOT NULL,
  type TEXT NOT NULL,
  status TEXT NOT NULL,
  progress REAL NOT NULL,
  priority INTEGER NOT NULL,
  worker_version TEXT,
  started_at TEXT,
  finished_at TEXT,
  result_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ai_jobs_project ON ai_jobs(project_id);

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY NOT NULL,
  project_id TEXT NOT NULL,
  type TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  device_time TEXT NOT NULL,
  app_version TEXT NOT NULL,
  os_version TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_events_project_created ON events(project_id, created_at);
`;

let dbInstance: SQLite.SQLiteDatabase | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (dbInstance) return dbInstance;
  const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
  await db.execAsync('PRAGMA journal_mode = WAL;');
  await db.execAsync(CREATE_STATEMENTS);
  dbInstance = db;
  return db;
}
