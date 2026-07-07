// Repository interfaces — pure contracts. `database/` implements these against
// SQLite (local), `remote/` implements the subset needed against Supabase.
// Callers (services/) depend only on these interfaces, never on a concrete impl.
import { AiJob } from '../domain/aiJob/types';
import { Asset } from '../domain/asset/types';
import { CaptionCue } from '../domain/caption/types';
import { Clip } from '../domain/clip/types';
import { EventLogEntry } from '../domain/event/types';
import { ExportVersion } from '../domain/exportVersion/types';
import { Project } from '../domain/project/types';
import { SyncQueueTask } from '../domain/sync/types';
import { Track } from '../domain/track/types';

export interface ProjectRepository {
  create(project: Project): Promise<void>;
  getById(id: string): Promise<Project | null>;
  getMostRecentDraftOrEditing(date: string): Promise<Project | null>;
  list(): Promise<Project[]>;
  listByStatus(status: Project['status']): Promise<Project[]>;
  update(id: string, patch: Partial<Project>): Promise<void>;
}

export interface TrackRepository {
  create(track: Track): Promise<void>;
  listByProject(projectId: string): Promise<Track[]>;
  getByProjectAndType(projectId: string, type: Track['type']): Promise<Track | null>;
}

export interface AssetRepository {
  create(asset: Asset): Promise<void>;
  getById(id: string): Promise<Asset | null>;
  listByProject(projectId: string): Promise<Asset[]>;
  update(id: string, patch: Partial<Asset>): Promise<void>;
}

export interface ClipRepository {
  create(clip: Clip): Promise<void>;
  getById(id: string): Promise<Clip | null>;
  listByTrack(trackId: string, options?: { includeHidden?: boolean }): Promise<Clip[]>;
  listByProject(projectId: string, options?: { includeHidden?: boolean }): Promise<Clip[]>;
  update(id: string, patch: Partial<Clip>): Promise<void>;
}

export interface ExportVersionRepository {
  create(version: ExportVersion): Promise<void>;
  getById(id: string): Promise<ExportVersion | null>;
  listByProject(projectId: string): Promise<ExportVersion[]>;
  update(id: string, patch: Partial<ExportVersion>): Promise<void>;
}

export interface SyncQueueRepository {
  enqueue(task: SyncQueueTask): Promise<void>;
  listPending(): Promise<SyncQueueTask[]>;
  listInProgress(): Promise<SyncQueueTask[]>;
  listByProject(projectId: string): Promise<SyncQueueTask[]>;
  update(taskId: string, patch: Partial<SyncQueueTask>): Promise<void>;
}

export interface AiJobRepository {
  create(job: AiJob): Promise<void>;
  getById(id: string): Promise<AiJob | null>;
  listByProject(projectId: string): Promise<AiJob[]>;
  update(id: string, patch: Partial<AiJob>): Promise<void>;
}

export interface EventRepository {
  append(event: EventLogEntry): Promise<void>;
  listByProject(projectId: string): Promise<EventLogEntry[]>;
}

export interface CaptionCueRepository {
  create(cue: CaptionCue): Promise<void>;
  listByProject(projectId: string): Promise<CaptionCue[]>;
  deleteByProject(projectId: string): Promise<void>;
}
