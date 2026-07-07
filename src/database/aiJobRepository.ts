import { AiJobRepository } from '../data/repositories';
import { AiJob } from '../domain/aiJob/types';
import { getDatabase } from './schema';

interface AiJobRow {
  id: string;
  project_id: string;
  type: string;
  status: string;
  progress: number;
  priority: number;
  worker_version: string | null;
  started_at: string | null;
  finished_at: string | null;
  result_json: string | null;
  created_at: string;
  updated_at: string;
}

function toDomain(row: AiJobRow): AiJob {
  return {
    id: row.id,
    projectId: row.project_id,
    type: row.type as AiJob['type'],
    status: row.status as AiJob['status'],
    progress: row.progress,
    priority: row.priority,
    workerVersion: row.worker_version,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    result: row.result_json ? JSON.parse(row.result_json) : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// No producer/consumer logic in Phase 1 — this repository exists purely so the
// schema is ready for Phase 2 (architecture doc v4.1 §1.7 / §7).
export function createAiJobRepository(): AiJobRepository {
  const repo: AiJobRepository = {
    async create(job) {
      const db = await getDatabase();
      await db.runAsync(
        `INSERT INTO ai_jobs (id, project_id, type, status, progress, priority, worker_version, started_at, finished_at, result_json, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          job.id,
          job.projectId,
          job.type,
          job.status,
          job.progress,
          job.priority,
          job.workerVersion,
          job.startedAt,
          job.finishedAt,
          job.result ? JSON.stringify(job.result) : null,
          job.createdAt,
          job.updatedAt,
        ]
      );
    },

    async getById(id) {
      const db = await getDatabase();
      const row = await db.getFirstAsync<AiJobRow>('SELECT * FROM ai_jobs WHERE id = ?', [id]);
      return row ? toDomain(row) : null;
    },

    async listByProject(projectId) {
      const db = await getDatabase();
      const rows = await db.getAllAsync<AiJobRow>(
        'SELECT * FROM ai_jobs WHERE project_id = ? ORDER BY created_at DESC',
        [projectId]
      );
      return rows.map(toDomain);
    },

    async update(id, patch) {
      const db = await getDatabase();
      const current = await repo.getById(id);
      if (!current) throw new Error(`AiJob ${id} not found`);
      const next: AiJob = { ...current, ...patch };
      await db.runAsync(
        `UPDATE ai_jobs SET status = ?, progress = ?, priority = ?, worker_version = ?, started_at = ?, finished_at = ?, result_json = ?, updated_at = ? WHERE id = ?`,
        [
          next.status,
          next.progress,
          next.priority,
          next.workerVersion,
          next.startedAt,
          next.finishedAt,
          next.result ? JSON.stringify(next.result) : null,
          next.updatedAt,
          id,
        ]
      );
    },
  };
  return repo;
}
