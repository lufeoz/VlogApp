import { ProjectRepository } from '../data/repositories';
import { Project } from '../domain/project/types';
import { getDatabase } from './schema';

interface ProjectRow {
  id: string;
  title: string;
  date: string;
  status: string;
  settings_json: string;
  cover_image_uri: string | null;
  latest_version_id: string | null;
  published_version_id: string | null;
  created_at: string;
  updated_at: string;
}

function toDomain(row: ProjectRow): Project {
  return {
    id: row.id,
    title: row.title,
    date: row.date,
    status: row.status as Project['status'],
    settings: JSON.parse(row.settings_json),
    coverImageUri: row.cover_image_uri,
    latestVersionId: row.latest_version_id,
    publishedVersionId: row.published_version_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createProjectRepository(): ProjectRepository {
  const repo: ProjectRepository = {
    async create(project) {
      const db = await getDatabase();
      await db.runAsync(
        `INSERT INTO projects (id, title, date, status, settings_json, cover_image_uri, latest_version_id, published_version_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          project.id,
          project.title,
          project.date,
          project.status,
          JSON.stringify(project.settings),
          project.coverImageUri,
          project.latestVersionId,
          project.publishedVersionId,
          project.createdAt,
          project.updatedAt,
        ]
      );
    },

    async getById(id) {
      const db = await getDatabase();
      const row = await db.getFirstAsync<ProjectRow>('SELECT * FROM projects WHERE id = ?', [id]);
      return row ? toDomain(row) : null;
    },

    async getMostRecentDraftOrEditing(date) {
      const db = await getDatabase();
      const row = await db.getFirstAsync<ProjectRow>(
        `SELECT * FROM projects
         WHERE date = ? AND status IN ('draft', 'editing')
         ORDER BY updated_at DESC LIMIT 1`,
        [date]
      );
      return row ? toDomain(row) : null;
    },

    async list() {
      const db = await getDatabase();
      const rows = await db.getAllAsync<ProjectRow>('SELECT * FROM projects ORDER BY date DESC');
      return rows.map(toDomain);
    },

    async update(id, patch) {
      const db = await getDatabase();
      const current = await repo.getById(id);
      if (!current) throw new Error(`Project ${id} not found`);
      const next: Project = { ...current, ...patch };
      await db.runAsync(
        `UPDATE projects SET title = ?, date = ?, status = ?, settings_json = ?, cover_image_uri = ?,
         latest_version_id = ?, published_version_id = ?, updated_at = ? WHERE id = ?`,
        [
          next.title,
          next.date,
          next.status,
          JSON.stringify(next.settings),
          next.coverImageUri,
          next.latestVersionId,
          next.publishedVersionId,
          next.updatedAt,
          id,
        ]
      );
    },
  };
  return repo;
}
