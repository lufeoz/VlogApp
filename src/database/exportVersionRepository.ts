import { ExportVersionRepository } from '../data/repositories';
import { ExportVersion } from '../domain/exportVersion/types';
import { getDatabase } from './schema';

interface ExportVersionRow {
  id: string;
  project_id: string;
  version_number: number;
  local_uri: string | null;
  remote_uri: string | null;
  thumbnail_uri: string | null;
  status: string;
  composition_snapshot_json: string;
  settings_snapshot_json: string;
  sync_status: string;
  created_at: string;
  completed_at: string | null;
}

function toDomain(row: ExportVersionRow): ExportVersion {
  return {
    id: row.id,
    projectId: row.project_id,
    versionNumber: row.version_number,
    localUri: row.local_uri,
    remoteUri: row.remote_uri,
    thumbnailUri: row.thumbnail_uri,
    status: row.status as ExportVersion['status'],
    compositionSnapshot: JSON.parse(row.composition_snapshot_json),
    settingsSnapshot: JSON.parse(row.settings_snapshot_json),
    syncStatus: row.sync_status as ExportVersion['syncStatus'],
    createdAt: row.created_at,
    completedAt: row.completed_at,
  };
}

export function createExportVersionRepository(): ExportVersionRepository {
  const repo: ExportVersionRepository = {
    async create(version) {
      const db = await getDatabase();
      await db.runAsync(
        `INSERT INTO export_versions (id, project_id, version_number, local_uri, remote_uri, thumbnail_uri, status, composition_snapshot_json, settings_snapshot_json, sync_status, created_at, completed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          version.id,
          version.projectId,
          version.versionNumber,
          version.localUri,
          version.remoteUri,
          version.thumbnailUri,
          version.status,
          JSON.stringify(version.compositionSnapshot),
          JSON.stringify(version.settingsSnapshot),
          version.syncStatus,
          version.createdAt,
          version.completedAt,
        ]
      );
    },

    async getById(id) {
      const db = await getDatabase();
      const row = await db.getFirstAsync<ExportVersionRow>(
        'SELECT * FROM export_versions WHERE id = ?',
        [id]
      );
      return row ? toDomain(row) : null;
    },

    async listByProject(projectId) {
      const db = await getDatabase();
      const rows = await db.getAllAsync<ExportVersionRow>(
        'SELECT * FROM export_versions WHERE project_id = ? ORDER BY version_number DESC',
        [projectId]
      );
      return rows.map(toDomain);
    },

    // compositionSnapshot/settingsSnapshot are write-once at creation (they ARE
    // the immutable record of what this version was exported with) — update()
    // only ever touches delivery/status fields, never the snapshots.
    async update(id, patch) {
      const db = await getDatabase();
      const current = await repo.getById(id);
      if (!current) throw new Error(`ExportVersion ${id} not found`);
      const next: ExportVersion = { ...current, ...patch };
      await db.runAsync(
        `UPDATE export_versions SET local_uri = ?, remote_uri = ?, thumbnail_uri = ?, status = ?, sync_status = ?, completed_at = ? WHERE id = ?`,
        [next.localUri, next.remoteUri, next.thumbnailUri, next.status, next.syncStatus, next.completedAt, id]
      );
    },
  };
  return repo;
}
