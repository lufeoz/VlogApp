import { TrackRepository } from '../data/repositories';
import { Track } from '../domain/track/types';
import { getDatabase } from './schema';

interface TrackRow {
  id: string;
  project_id: string;
  type: string;
  order_index: number;
  created_at: string;
}

function toDomain(row: TrackRow): Track {
  return {
    id: row.id,
    projectId: row.project_id,
    type: row.type as Track['type'],
    orderIndex: row.order_index,
    createdAt: row.created_at,
  };
}

export function createTrackRepository(): TrackRepository {
  return {
    async create(track) {
      const db = await getDatabase();
      await db.runAsync(
        `INSERT INTO tracks (id, project_id, type, order_index, created_at) VALUES (?, ?, ?, ?, ?)`,
        [track.id, track.projectId, track.type, track.orderIndex, track.createdAt]
      );
    },

    async listByProject(projectId) {
      const db = await getDatabase();
      const rows = await db.getAllAsync<TrackRow>(
        'SELECT * FROM tracks WHERE project_id = ? ORDER BY order_index ASC',
        [projectId]
      );
      return rows.map(toDomain);
    },

    async getByProjectAndType(projectId, type) {
      const db = await getDatabase();
      const row = await db.getFirstAsync<TrackRow>(
        'SELECT * FROM tracks WHERE project_id = ? AND type = ? LIMIT 1',
        [projectId, type]
      );
      return row ? toDomain(row) : null;
    },
  };
}
