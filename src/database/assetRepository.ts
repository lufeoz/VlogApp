import { AssetRepository } from '../data/repositories';
import { Asset } from '../domain/asset/types';
import { getDatabase } from './schema';

interface AssetRow {
  id: string;
  project_id: string;
  media_type: string;
  local_uri: string;
  remote_uri: string | null;
  duration: number;
  fps: number;
  width: number;
  height: number;
  thumbnail_uri: string;
  poster_frame_uri: string;
  sync_status: string;
  created_at: string;
}

function toDomain(row: AssetRow): Asset {
  return {
    id: row.id,
    projectId: row.project_id,
    mediaType: row.media_type as Asset['mediaType'],
    localUri: row.local_uri,
    remoteUri: row.remote_uri,
    duration: row.duration,
    fps: row.fps,
    resolution: { width: row.width, height: row.height },
    thumbnailUri: row.thumbnail_uri,
    posterFrameUri: row.poster_frame_uri,
    syncStatus: row.sync_status as Asset['syncStatus'],
    createdAt: row.created_at,
  };
}

export function createAssetRepository(): AssetRepository {
  const repo: AssetRepository = {
    async create(asset) {
      const db = await getDatabase();
      await db.runAsync(
        `INSERT INTO assets (id, project_id, media_type, local_uri, remote_uri, duration, fps, width, height, thumbnail_uri, poster_frame_uri, sync_status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          asset.id,
          asset.projectId,
          asset.mediaType,
          asset.localUri,
          asset.remoteUri,
          asset.duration,
          asset.fps,
          asset.resolution.width,
          asset.resolution.height,
          asset.thumbnailUri,
          asset.posterFrameUri,
          asset.syncStatus,
          asset.createdAt,
        ]
      );
    },

    async getById(id) {
      const db = await getDatabase();
      const row = await db.getFirstAsync<AssetRow>('SELECT * FROM assets WHERE id = ?', [id]);
      return row ? toDomain(row) : null;
    },

    async listByProject(projectId) {
      const db = await getDatabase();
      const rows = await db.getAllAsync<AssetRow>(
        'SELECT * FROM assets WHERE project_id = ? ORDER BY created_at ASC',
        [projectId]
      );
      return rows.map(toDomain);
    },

    // Asset is immutable (architecture doc v4.1 §2): only remoteUri/syncStatus
    // ever change post-creation, so this intentionally ignores any other field
    // in `patch` rather than exposing a generic mutator.
    async update(id, patch) {
      const db = await getDatabase();
      const current = await repo.getById(id);
      if (!current) throw new Error(`Asset ${id} not found`);
      const next: Asset = { ...current, ...patch };
      await db.runAsync(
        `UPDATE assets SET remote_uri = ?, sync_status = ? WHERE id = ?`,
        [next.remoteUri, next.syncStatus, id]
      );
    },
  };
  return repo;
}
