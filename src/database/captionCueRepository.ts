import { CaptionCueRepository } from '../data/repositories';
import { CaptionCue } from '../domain/caption/types';
import { getDatabase } from './schema';

interface CaptionCueRow {
  id: string;
  project_id: string;
  track_id: string;
  export_version_id: string;
  text: string;
  start_ms: number;
  end_ms: number;
  order_index: number;
  created_at: string;
}

function toDomain(row: CaptionCueRow): CaptionCue {
  return {
    id: row.id,
    projectId: row.project_id,
    trackId: row.track_id,
    exportVersionId: row.export_version_id,
    text: row.text,
    startMs: row.start_ms,
    endMs: row.end_ms,
    orderIndex: row.order_index,
    createdAt: row.created_at,
  };
}

export function createCaptionCueRepository(): CaptionCueRepository {
  return {
    async create(cue) {
      const db = await getDatabase();
      await db.runAsync(
        `INSERT INTO caption_cues (id, project_id, track_id, export_version_id, text, start_ms, end_ms, order_index, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          cue.id,
          cue.projectId,
          cue.trackId,
          cue.exportVersionId,
          cue.text,
          cue.startMs,
          cue.endMs,
          cue.orderIndex,
          cue.createdAt,
        ]
      );
    },

    async listByProject(projectId) {
      const db = await getDatabase();
      const rows = await db.getAllAsync<CaptionCueRow>(
        'SELECT * FROM caption_cues WHERE project_id = ? ORDER BY order_index ASC',
        [projectId]
      );
      return rows.map(toDomain);
    },

    async deleteByProject(projectId) {
      const db = await getDatabase();
      await db.runAsync('DELETE FROM caption_cues WHERE project_id = ?', [projectId]);
    },
  };
}
