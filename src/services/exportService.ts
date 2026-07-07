import videoComposer from '../../modules/video-composer/src/VideoComposerModule';
import { localRepositories } from '../database';
import { ClipWithAsset, buildCompositionSpec, TrackWithClips } from '../domain/composition/builder';
import { buildPendingExportVersion } from '../domain/exportVersion/logic';
import { canEditClips } from '../domain/project/logic';
import { logEvent } from './eventLogger';
import { generateId } from './id';
import { saveVideoToPhotoLibrary } from './mediaLibrary';
import { assertNativeFeatureAvailable } from './platformSupport';
import { enqueueProjectBackup, processSyncQueue } from './syncService';
import { generateSingleThumbnail } from './thumbnails';

// Gathers every track (video, audio, ...) with its visible+hidden clips and
// resolved assets — the builder decides what actually participates. Separate
// from projectService.getProjectDetail, which is scoped to the video-track
// clip-editing UI only.
async function getTracksWithClips(projectId: string): Promise<TrackWithClips[]> {
  const tracks = await localRepositories.tracks.listByProject(projectId);
  const assets = await localRepositories.assets.listByProject(projectId);
  const assetById = new Map(assets.map((asset) => [asset.id, asset]));

  const result: TrackWithClips[] = [];
  for (const track of tracks) {
    const clips = await localRepositories.clips.listByTrack(track.id, { includeHidden: true });
    const clipsWithAssets: ClipWithAsset[] = clips.map((clip) => {
      const asset = assetById.get(clip.assetId);
      if (!asset) throw new Error(`Invariant violated: clip ${clip.id} references missing asset ${clip.assetId}`);
      return { clip, asset };
    });
    result.push({ track, clips: clipsWithAssets });
  }
  return result;
}

// The single entry point the "완료" button calls. Orchestrates: build spec →
// native composeAsync → ExportVersion (+ thumbnail) → project status/version
// pointers → event log → save to Photo Library (architecture doc v4.1 core flow).
export async function exportProject(projectId: string): Promise<void> {
  assertNativeFeatureAvailable('내보내기');

  const project = await localRepositories.projects.getById(projectId);
  if (!project) throw new Error(`Project ${projectId} not found`);

  if (!canEditClips(project.status)) {
    throw new Error(`Cannot export while project is ${project.status}`);
  }

  const tracksWithClips = await getTracksWithClips(projectId);
  const spec = buildCompositionSpec(project, tracksWithClips);

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
