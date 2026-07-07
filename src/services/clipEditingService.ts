import { localRepositories } from '../database';
import {
  computeReorder,
  computeTrim,
  hideClip as computeHideClip,
  restoreClip as computeRestoreClip,
} from '../domain/clip/logic';
import { afterClipEdited, canEditClips } from '../domain/project/logic';
import { ProjectStatus } from '../domain/project/types';
import { logEvent } from './eventLogger';

async function loadEditableClipAndProject(clipId: string) {
  const clip = await localRepositories.clips.getById(clipId);
  if (!clip) throw new Error(`Clip ${clipId} not found`);
  const project = await localRepositories.projects.getById(clip.projectId);
  if (!project) throw new Error(`Project ${clip.projectId} not found`);
  if (!canEditClips(project.status)) {
    throw new Error(`Cannot edit clips while project is ${project.status}`);
  }
  return { clip, project };
}

async function markProjectEdited(projectId: string, currentStatus: ProjectStatus): Promise<void> {
  const nextStatus = afterClipEdited(currentStatus);
  await localRepositories.projects.update(projectId, { status: nextStatus, updatedAt: new Date().toISOString() });
}

export async function reorderClips(trackId: string, orderedClipIds: string[]): Promise<void> {
  const visibleClips = await localRepositories.clips.listByTrack(trackId);
  if (visibleClips.length === 0) return;

  const project = await localRepositories.projects.getById(visibleClips[0].projectId);
  if (!project) throw new Error(`Project not found for track ${trackId}`);
  if (!canEditClips(project.status)) {
    throw new Error(`Cannot edit clips while project is ${project.status}`);
  }

  const assignments = computeReorder(visibleClips, orderedClipIds);
  const now = new Date().toISOString();
  for (const { clipId, orderIndex } of assignments) {
    await localRepositories.clips.update(clipId, { orderIndex, updatedAt: now });
  }

  await logEvent(project.id, 'ClipReordered', { trackId, orderedClipIds });
  await markProjectEdited(project.id, project.status);
}

export async function trimClip(clipId: string, trimStart: number, trimEnd: number): Promise<void> {
  const { clip, project } = await loadEditableClipAndProject(clipId);
  const asset = await localRepositories.assets.getById(clip.assetId);
  if (!asset) throw new Error(`Asset ${clip.assetId} not found`);

  const before = { trimStart: clip.trimStart, trimEnd: clip.trimEnd };
  const after = computeTrim(asset.duration, trimStart, trimEnd);

  const now = new Date().toISOString();
  await localRepositories.clips.update(clipId, { ...after, updatedAt: now });

  await logEvent(project.id, 'ClipTrimmed', { clipId, before, after });
  await markProjectEdited(project.id, project.status);
}

export async function hideClipById(clipId: string): Promise<void> {
  const { project } = await loadEditableClipAndProject(clipId);
  const now = new Date().toISOString();
  const patch = computeHideClip(now);
  await localRepositories.clips.update(clipId, { ...patch, updatedAt: now });

  await logEvent(project.id, 'ClipDeleted', { clipId });
  await markProjectEdited(project.id, project.status);
}

export async function restoreClipById(clipId: string): Promise<void> {
  const { clip, project } = await loadEditableClipAndProject(clipId);
  const visibleClips = await localRepositories.clips.listByTrack(clip.trackId);
  const patch = computeRestoreClip(visibleClips.length);

  const now = new Date().toISOString();
  await localRepositories.clips.update(clipId, { ...patch, updatedAt: now });

  await logEvent(project.id, 'ClipRestored', { clipId, orderIndex: patch.orderIndex });
  await markProjectEdited(project.id, project.status);
}
