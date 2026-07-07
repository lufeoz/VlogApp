import { Project, ProjectSettings, ProjectStatus } from './types';

export function canRecordClip(status: ProjectStatus): boolean {
  return status === 'draft' || status === 'editing';
}

// First clip moves a project out of `draft`; every later recording is a no-op
// on status (already `editing`, or re-entering `editing` from `completed`/
// `synced` is handled separately by the clip-editing flow in M2, not here).
export function afterClipRecorded(status: ProjectStatus): ProjectStatus {
  return status === 'draft' ? 'editing' : status;
}

// Editing while an export/backup is actually in flight would race with
// whatever is reading the clips at that moment — blocked until that operation
// resolves (M3/M4 are what actually drive a project into these states).
export function canEditClips(status: ProjectStatus): boolean {
  return status !== 'exporting' && status !== 'syncing';
}

// Editing clips after a project was already exported/synced means the existing
// result is stale — bring it back to `editing` so a new export is expected.
export function afterClipEdited(status: ProjectStatus): ProjectStatus {
  if (status === 'completed' || status === 'synced' || status === 'error') return 'editing';
  return status;
}

export function buildNewProject(params: {
  id: string;
  date: string;
  settings: ProjectSettings;
  now: string;
}): Project {
  return {
    id: params.id,
    title: `Vlog ${params.date}`,
    date: params.date,
    status: 'draft',
    settings: params.settings,
    coverImageUri: null,
    latestVersionId: null,
    publishedVersionId: null,
    createdAt: params.now,
    updatedAt: params.now,
  };
}
