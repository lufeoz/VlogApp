import { EventRepository } from '../data/repositories';
import { EventLogEntry } from '../domain/event/types';
import { getDatabase } from './schema';

interface EventRow {
  id: string;
  project_id: string;
  type: string;
  payload_json: string;
  device_time: string;
  app_version: string;
  os_version: string;
  created_at: string;
}

function toDomain(row: EventRow): EventLogEntry {
  return {
    id: row.id,
    projectId: row.project_id,
    type: row.type as EventLogEntry['type'],
    payload: JSON.parse(row.payload_json),
    deviceTime: row.device_time,
    appVersion: row.app_version,
    osVersion: row.os_version,
    createdAt: row.created_at,
  };
}

// Append-only: intentionally no update()/delete() method exists on this repository.
export function createEventRepository(): EventRepository {
  return {
    async append(event) {
      const db = await getDatabase();
      await db.runAsync(
        `INSERT INTO events (id, project_id, type, payload_json, device_time, app_version, os_version, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          event.id,
          event.projectId,
          event.type,
          JSON.stringify(event.payload),
          event.deviceTime,
          event.appVersion,
          event.osVersion,
          event.createdAt,
        ]
      );
    },

    async listByProject(projectId) {
      const db = await getDatabase();
      const rows = await db.getAllAsync<EventRow>(
        'SELECT * FROM events WHERE project_id = ? ORDER BY created_at ASC',
        [projectId]
      );
      return rows.map(toDomain);
    },
  };
}
