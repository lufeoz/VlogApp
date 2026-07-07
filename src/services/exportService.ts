import videoComposer from '../../modules/video-composer/src/VideoComposerModule';
import { localRepositories } from '../database';
import { buildCompositionSpec } from '../domain/composition/builder';
import { buildPendingExportVersion } from '../domain/exportVersion/logic';
import { canEditClips } from '../domain/project/logic';
import { logEvent } from './eventLogger';
import { generateId } from './id';
import { saveVideoToPhotoLibrary } from './mediaLibrary';
import { getProjectDetail } from './projectService';
import { enqueueProjectBackup, processSyncQueue } from './syncService';
import { generateSingleThumbnail } from './thumbnails';

// The single entry point the "완료" button calls. Orchestrates: build spec →
// native composeAsync → ExportVersion (+ thumbnail) → project status/version
// pointers → event log → save to Photo Library (architecture doc v4.1 core flow).
export async function exportProject(projectId: string): Promise<void> {
  const detail = await getProjectDetail(projectId);
  if (!detail) throw new Error(`Project ${projectId} not found`);
  const { project, videoTrack, visibleClips } = detail;

  if (!canEditClips(project.status)) {
    throw new Error(`Cannot export while project is ${project.status}`);
  }

  const spec = buildCompositionSpec(project, videoTrack, visibleClips);

  const existingVersions = await localRepositories.exportVersions.listByProject(projectId);
  const versionNumber = existingVersions.length + 1;

  const startedAt = new Date().toISOString();
  const version = buildPendingExportVersion({
    id: generateId(),
    projectId,
    versionNumber,
    compositionSnapshot: spec,
    settingsSnapshot: project.settings,
    now: startedAt,
  });
  await localRepositories.exportVersions.create(version);
  await localRepositories.projects.update(projectId, { status: 'exporting', updatedAt: startedAt });
  await logEvent(projectId, 'ExportStarted', { versionId: version.id, versionNumber });

  let outputUri: string;
  try {
    const result = await videoComposer.composeAsync(spec);
    outputUri = result.outputUri;
    const thumbnailUri = await generateSingleThumbnail(outputUri, 0);

    const completedAt = new Date().toISOString();
    await localRepositories.exportVersions.update(version.id, {
      localUri: outputUri,
      thumbnailUri,
      status: 'completed',
      completedAt,
    });
    await localRepositories.projects.update(projectId, {
      status: 'completed',
      latestVersionId: version.id,
      publishedVersionId: version.id,
      coverImageUri: thumbnailUri,
      updatedAt: completedAt,
    });
    await logEvent(projectId, 'ProjectExported', { versionId: version.id, versionNumber });
  } catch (error) {
    const failedAt = new Date().toISOString();
    await localRepositories.exportVersions.update(version.id, { status: 'failed', completedAt: failedAt });
    await localRepositories.projects.update(projectId, { status: 'error', updatedAt: failedAt });
    await logEvent(projectId, 'ExportFailed', {
      versionId: version.id,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }

  // Best-effort and deliberately outside the try/catch above: a failure to
  // save into Photos must not undo an otherwise-successful export/version.
  await saveVideoToPhotoLibrary(outputUri);

  // Background backup (architecture doc v4.1 core flow): only after export +
  // Photos save have fully succeeded. Enqueueing is awaited (fast DB writes);
  // the actual upload drain is fire-and-forget so the user isn't blocked
  // waiting on network I/O after tapping "완료".
  await enqueueProjectBackup(projectId, version.id);
  processSyncQueue().catch((error) => {
    console.error('Background sync failed', error);
  });
}
