import { localRepositories } from '../database';
import { Asset } from '../domain/asset/types';
import { Clip } from '../domain/clip/types';
import { DEFAULT_PROJECT_SETTINGS } from '../domain/project/defaultSettings';
import { buildNewProject } from '../domain/project/logic';
import { Project } from '../domain/project/types';
import { formatLocalDate } from '../domain/shared/date';
import { Track } from '../domain/track/types';
import { logEvent } from './eventLogger';
import { generateId } from './id';

export interface TodayProjectSummary {
  project: Project | null;
  clipCount: number;
}

// Read-only query for the home screen.
export async function getTodayProjectSummary(): Promise<TodayProjectSummary> {
  const today = formatLocalDate(new Date());
  const project = await localRepositories.projects.getMostRecentDraftOrEditing(today);
  if (!project) return { project: null, clipCount: 0 };

  const clips = await localRepositories.clips.listByProject(project.id);
  return { project, clipCount: clips.length };
}

// All projects, most recent first — backs the project list / "past
// projects" browsing needed for Phase 3 (editing previously-shot footage
// means opening a project other than today's).
export async function listProjects(): Promise<Project[]> {
  return localRepositories.projects.list();
}

// Always creates a fresh project + its default video track — unlike
// recordingService's getOrCreateActiveProject, which reuses today's
// draft/editing project. Used both by the recording flow (via that reuse
// wrapper) and by the explicit "새 프로젝트" UI action (Phase 3), since
// editing existing footage doesn't need to be tied to "today".
export async function createProject(): Promise<Project> {
  const now = new Date().toISOString();
  const project = buildNewProject({
    id: generateId(),
    date: formatLocalDate(new Date()),
    settings: DEFAULT_PROJECT_SETTINGS,
    now,
  });
  await localRepositories.projects.create(project);

  const videoTrack: Track = {
    id: generateId(),
    projectId: project.id,
    type: 'video',
    orderIndex: 0,
    createdAt: now,
  };
  await localRepositories.tracks.create(videoTrack);

  await logEvent(project.id, 'ProjectCreated', { projectId: project.id });

  return project;
}

export interface ClipWithAsset {
  clip: Clip;
  asset: Asset;
}

export interface ProjectDetail {
  project: Project;
  videoTrack: Track;
  visibleClips: ClipWithAsset[];
  hiddenClips: ClipWithAsset[];
  failedSyncTaskCount: number;
}

// Read-only query backing the project editing screen (M2/M5).
export async function getProjectDetail(projectId: string): Promise<ProjectDetail | null> {
  const project = await localRepositories.projects.getById(projectId);
  if (!project) return null;

  const videoTrack = await localRepositories.tracks.getByProjectAndType(projectId, 'video');
  if (!videoTrack) throw new Error(`Invariant violated: project ${projectId} has no video track`);

  const allClips = await localRepositories.clips.listByTrack(videoTrack.id, { includeHidden: true });
  const assets = await localRepositories.assets.listByProject(projectId);
  const assetById = new Map(assets.map((asset) => [asset.id, asset]));

  const withAsset = (clip: Clip): ClipWithAsset => {
    const asset = assetById.get(clip.assetId);
    if (!asset) throw new Error(`Invariant violated: clip ${clip.id} references missing asset ${clip.assetId}`);
    return { clip, asset };
  };

  const syncTasks = await localRepositories.syncQueue.listByProject(projectId);

  return {
    project,
    videoTrack,
    visibleClips: allClips.filter((clip) => clip.visibility === 'visible').map(withAsset),
    hiddenClips: allClips.filter((clip) => clip.visibility === 'hidden').map(withAsset),
    failedSyncTaskCount: syncTasks.filter((task) => task.status === 'failed').length,
  };
}
