import { SyncQueueRepository } from '../data/repositories';
import { SyncQueueTask } from '../domain/sync/types';
import { getDatabase } from './schema';

interface SyncQueueRow {
  task_id: string;
  project_id: string;
  target_id: string;
  type: string;
  status: string;
  priority: number;
  retry_count: number;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

function toDomain(row: SyncQueueRow): SyncQueueTask {
  return {
    taskId: row.task_id,
    projectId: row.project_id,
    targetId: row.target_id,
    type: row.type as SyncQueueTask['type'],
    status: row.status as SyncQueueTask['status'],
    priority: row.priority,
    retryCount: row.retry_count,
    lastError: row.last_error,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createSyncQueueRepository(): SyncQueueRepository {
  return {
    async enqueue(task) {
      const db = await getDatabase();
      await db.runAsync(
        `INSERT INTO sync_queue (task_id, project_id, target_id, type, status, priority, retry_count, last_error, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          task.taskId,
          task.projectId,
          task.targetId,
          task.type,
          task.status,
          task.priority,
          task.retryCount,
          task.lastError,
          task.createdAt,
          task.updatedAt,
        ]
      );
    },

    async listPending() {
      const db = await getDatabase();
      const rows = await db.getAllAsync<SyncQueueRow>(
        `SELECT * FROM sync_queue WHERE status = 'pending' ORDER BY priority DESC, created_at ASC`
      );
      return rows.map(toDomain);
    },

    async listInProgress() {
      const db = await getDatabase();
      const rows = await db.getAllAsync<SyncQueueRow>(
        `SELECT * FROM sync_queue WHERE status = 'in_progress'`
      );
      return rows.map(toDomain);
    },

    async listByProject(projectId) {
      const db = await getDatabase();
      const rows = await db.getAllAsync<SyncQueueRow>(
        `SELECT * FROM sync_queue WHERE project_id = ? ORDER BY created_at ASC`,
        [projectId]
      );
      return rows.map(toDomain);
    },

    async update(taskId, patch) {
      const db = await getDatabase();
      const row = await db.getFirstAsync<SyncQueueRow>('SELECT * FROM sync_queue WHERE task_id = ?', [
        taskId,
      ]);
      if (!row) throw new Error(`SyncQueueTask ${taskId} not found`);
      const next: SyncQueueTask = { ...toDomain(row), ...patch };
      await db.runAsync(
        `UPDATE sync_queue SET status = ?, retry_count = ?, last_error = ?, updated_at = ? WHERE task_id = ?`,
        [next.status, next.retryCount, next.lastError, next.updatedAt, taskId]
      );
    },
  };
}
