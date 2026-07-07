import { ClipRepository } from '../data/repositories';
import { Clip } from '../domain/clip/types';
import { getDatabase } from './schema';

interface ClipRow {
  id: string;
  project_id: string;
  track_id: string;
  asset_id: string;
  order_index: number;
  trim_start: number;
  trim_end: number;
  effects_json: string;
  rotation: number;
  crop_json: string | null;
  transform_json: string | null;
  visibility: string;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

function toDomain(row: ClipRow): Clip {
  return {
    id: row.id,
    projectId: row.project_id,
    trackId: row.track_id,
    assetId: row.asset_id,
    orderIndex: row.order_index,
    trimStart: row.trim_start,
    trimEnd: row.trim_end,
    effects: JSON.parse(row.effects_json),
    rotation: row.rotation,
    crop: row.crop_json ? JSON.parse(row.crop_json) : null,
    transform: row.transform_json ? JSON.parse(row.transform_json) : null,
    visibility: row.visibility as Clip['visibility'],
    deletedAt: row.deleted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createClipRepository(): ClipRepository {
  const repo: ClipRepository = {
    async create(clip) {
      const db = await getDatabase();
      await db.runAsync(
        `INSERT INTO clips (id, project_id, track_id, asset_id, order_index, trim_start, trim_end, effects_json, rotation, crop_json, transform_json, visibility, deleted_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          clip.id,
          clip.projectId,
          clip.trackId,
          clip.assetId,
          clip.orderIndex,
          clip.trimStart,
          clip.trimEnd,
          JSON.stringify(clip.effects),
          clip.rotation,
          clip.crop ? JSON.stringify(clip.crop) : null,
          clip.transform ? JSON.stringify(clip.transform) : null,
          clip.visibility,
          clip.deletedAt,
          clip.createdAt,
          clip.updatedAt,
        ]
      );
    },

    async getById(id) {
      const db = await getDatabase();
      const row = await db.getFirstAsync<ClipRow>('SELECT * FROM clips WHERE id = ?', [id]);
      return row ? toDomain(row) : null;
    },

    async listByTrack(trackId, options) {
      const db = await getDatabase();
      const visibilityFilter = options?.includeHidden ? '' : "AND visibility = 'visible'";
      const rows = await db.getAllAsync<ClipRow>(
        `SELECT * FROM clips WHERE track_id = ? ${visibilityFilter} ORDER BY order_index ASC`,
        [trackId]
      );
      return rows.map(toDomain);
    },

    async listByProject(projectId, options) {
      const db = await getDatabase();
      const visibilityFilter = options?.includeHidden ? '' : "AND visibility = 'visible'";
      const rows = await db.getAllAsync<ClipRow>(
        `SELECT * FROM clips WHERE project_id = ? ${visibilityFilter} ORDER BY track_id ASC, order_index ASC`,
        [projectId]
      );
      return rows.map(toDomain);
    },

    async update(id, patch) {
      const db = await getDatabase();
      const current = await repo.getById(id);
      if (!current) throw new Error(`Clip ${id} not found`);
      const next: Clip = { ...current, ...patch };
      await db.runAsync(
        `UPDATE clips SET order_index = ?, trim_start = ?, trim_end = ?, effects_json = ?, rotation = ?, crop_json = ?, transform_json = ?, visibility = ?, deleted_at = ?, updated_at = ? WHERE id = ?`,
        [
          next.orderIndex,
          next.trimStart,
          next.trimEnd,
          JSON.stringify(next.effects),
          next.rotation,
          next.crop ? JSON.stringify(next.crop) : null,
          next.transform ? JSON.stringify(next.transform) : null,
          next.visibility,
          next.deletedAt,
          next.updatedAt,
          id,
        ]
      );
    },
  };
  return repo;
}
