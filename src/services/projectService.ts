import { localRepositories } from '../database';
import { Asset } from '../domain/asset/types';
import { Clip } from '../domain/clip/types';
import { Project } from '../domain/project/types';
import { formatLocalDate } from '../domain/shared/date';
import { Track } from '../domain/track/types';

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
