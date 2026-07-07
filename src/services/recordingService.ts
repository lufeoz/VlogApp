import { localRepositories } from '../database';
import { buildRecordedAsset } from '../domain/asset/logic';
import { buildRecordedClip } from '../domain/clip/logic';
import { Clip } from '../domain/clip/types';
import { DEFAULT_PROJECT_SETTINGS } from '../domain/project/defaultSettings';
import { afterClipRecorded, buildNewProject } from '../domain/project/logic';
import { Project } from '../domain/project/types';
import { formatLocalDate } from '../domain/shared/date';
import { Track } from '../domain/track/types';
import { logEvent } from './eventLogger';
import { generateId } from './id';
import { generateThumbnails } from './thumbnails';

// Reuses today's draft/editing project if one exists, otherwise creates a new
// project + its default video track (architecture doc v4.1: project-based,
// never gallery-based — every recorded clip belongs to a project automatically).
async function getOrCreateActiveProject(): Promise<Project> {
  const today = formatLocalDate(new Date());
  const existing = await localRepositories.projects.getMostRecentDraftOrEditing(today);
  if (existing) return existing;

  const now = new Date().toISOString();
  const project = buildNewProject({
    id: generateId(),
    date: today,
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

export interface RecordClipInput {
  localUri: string;
  durationMs: number;
}

// The single entry point the camera UI calls after a recording finishes.
// Everything else (project resolution, Asset/Clip creation, event logging,
// status transition) is orchestrated here — never in the UI layer.
export async function recordClip(input: RecordClipInput): Promise<Clip> {
  const project = await getOrCreateActiveProject();
  const videoTrack = await localRepositories.tracks.getByProjectAndType(project.id, 'video');
  if (!videoTrack) {
    throw new Error(`Invariant violated: project ${project.id} has no video track`);
  }

  const { thumbnailUri, posterFrameUri } = await generateThumbnails(input.localUri, input.durationMs);
  const now = new Date().toISOString();

  const asset = buildRecordedAsset({
    id: generateId(),
    projectId: project.id,
    localUri: input.localUri,
    durationMs: input.durationMs,
    fps: project.settings.fps,
    resolution: project.settings.resolution,
    thumbnailUri,
    posterFrameUri,
    now,
  });
  await localRepositories.assets.create(asset);

  const existingClips = await localRepositories.clips.listByTrack(videoTrack.id, { includeHidden: true });

  const clip = buildRecordedClip({
    id: generateId(),
    projectId: project.id,
    trackId: videoTrack.id,
    assetId: asset.id,
    orderIndex: existingClips.length,
    durationMs: input.durationMs,
    now,
  });
  await localRepositories.clips.create(clip);

  await logEvent(project.id, 'ClipRecorded', {
    clipId: clip.id,
    assetId: asset.id,
    orderIndex: clip.orderIndex,
  });

  const nextStatus = afterClipRecorded(project.status);
  await localRepositories.projects.update(project.id, { status: nextStatus, updatedAt: now });

  return clip;
}
