import { localRepositories } from '../database';
import { buildProjectMetadataSnapshot } from '../domain/project/metadataSnapshot';
import { resolveSyncOutcome } from '../domain/sync/logic';
import { SYNC_MAX_RETRY_COUNT, SYNC_TASK_PRIORITY, SyncQueueTask } from '../domain/sync/types';
import { assetClipPath, exportVersionPath, metadataPath, thumbnailPath } from '../remote/storagePaths';
import { uploadFileToStorage, uploadJsonToStorage } from '../remote/storageUpload';
import { ensureAuthenticated } from '../remote/supabaseClient';
import { logEvent } from './eventLogger';
import { generateId } from './id';

function newTask(params: {
  projectId: string;
  targetId: string;
  type: SyncQueueTask['type'];
  now: string;
}): SyncQueueTask {
  return {
    taskId: generateId(),
    projectId: params.projectId,
    targetId: params.targetId,
    type: params.type,
    status: 'pending',
    priority: SYNC_TASK_PRIORITY[params.type],
    retryCount: 0,
    lastError: null,
    createdAt: params.now,
    updatedAt: params.now,
  };
}

// Called once, right after a project finishes exporting AND saving to Photos
// (architecture doc v4.1 §4/§10: only upload after export, never during
// recording). Enqueues every not-yet-uploaded Asset, the new ExportVersion,
// and a metadata snapshot, then flips the project into `syncing`.
export async function enqueueProjectBackup(projectId: string, exportVersionId: string): Promise<void> {
  const now = new Date().toISOString();

  const assets = await localRepositories.assets.listByProject(projectId);
  const pendingAssets = assets.filter((asset) => asset.syncStatus !== 'uploaded');

  for (const asset of pendingAssets) {
    await localRepositories.syncQueue.enqueue(
      newTask({ projectId, targetId: asset.id, type: 'UPLOAD_CLIP', now })
    );
  }

  await localRepositories.syncQueue.enqueue(
    newTask({ projectId, targetId: exportVersionId, type: 'UPLOAD_EXPORT', now })
  );
  await localRepositories.syncQueue.enqueue(
    newTask({ projectId, targetId: projectId, type: 'UPLOAD_METADATA', now })
  );

  await localRepositories.projects.update(projectId, { status: 'syncing', updatedAt: now });
  await logEvent(projectId, 'BackupStarted', { exportVersionId });
}

// A task that exhausted its retries (`failed`) is never picked up by a normal
// drain again on its own — this is the manual "재동기화" recovery action
// (architecture doc v4.1 §9): reset those specific tasks back to `pending`
// and re-drain.
export async function retryProjectSync(projectId: string): Promise<void> {
  const now = new Date().toISOString();
  const tasks = await localRepositories.syncQueue.listByProject(projectId);

  for (const task of tasks) {
    if (task.status !== 'failed') continue;
    await localRepositories.syncQueue.update(task.taskId, {
      status: 'pending',
      retryCount: 0,
      lastError: null,
      updatedAt: now,
    });
  }

  await localRepositories.projects.update(projectId, { status: 'syncing', updatedAt: now });
  await processSyncQueue();
}

// Drains every currently-pending task once. Safe to call repeatedly (e.g. on
// app foreground) — a task left `pending` after a failed attempt is simply
// picked up again on the next call. No background scheduler here (M5).
export async function processSyncQueue(): Promise<void> {
  await ensureAuthenticated();

  const tasks = await localRepositories.syncQueue.listPending();
  for (const task of tasks) {
    await processTask(task);
  }

  const touchedProjectIds = new Set(tasks.map((task) => task.projectId));
  for (const projectId of touchedProjectIds) {
    await finalizeProjectSyncIfDone(projectId);
  }
}

async function processTask(task: SyncQueueTask): Promise<void> {
  await localRepositories.syncQueue.update(task.taskId, {
    status: 'in_progress',
    updatedAt: new Date().toISOString(),
  });

  try {
    switch (task.type) {
      case 'UPLOAD_CLIP':
        await uploadClipTask(task);
        break;
      case 'UPLOAD_EXPORT':
        await uploadExportTask(task);
        break;
      case 'UPLOAD_METADATA':
        await uploadMetadataTask(task);
        break;
    }
    await localRepositories.syncQueue.update(task.taskId, {
      status: 'completed',
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const nextRetryCount = task.retryCount + 1;
    const isExhausted = nextRetryCount >= SYNC_MAX_RETRY_COUNT;

    await localRepositories.syncQueue.update(task.taskId, {
      status: isExhausted ? 'failed' : 'pending',
      retryCount: nextRetryCount,
      lastError: message,
      updatedAt: new Date().toISOString(),
    });

    if (isExhausted) {
      await logEvent(task.projectId, 'BackupFailed', { taskId: task.taskId, type: task.type, error: message });
    }
  }
}

async function uploadClipTask(task: SyncQueueTask): Promise<void> {
  const asset = await localRepositories.assets.getById(task.targetId);
  if (!asset) throw new Error(`Asset ${task.targetId} not found`);

  const storagePath = assetClipPath(task.projectId, asset.id);
  await uploadFileToStorage(storagePath, asset.localUri, 'video/mp4');

  // Storage layout (architecture doc v4.1 §5) has a dedicated thumbnails/
  // folder — uploaded as part of the same task rather than a new SyncQueue
  // task type, since the frozen SyncTaskType union isn't being changed for this.
  await uploadFileToStorage(thumbnailPath(task.projectId, asset.id), asset.thumbnailUri, 'image/jpeg');

  await localRepositories.assets.update(asset.id, { remoteUri: storagePath, syncStatus: 'uploaded' });
}

async function uploadExportTask(task: SyncQueueTask): Promise<void> {
  const version = await localRepositories.exportVersions.getById(task.targetId);
  if (!version || !version.localUri) {
    throw new Error(`ExportVersion ${task.targetId} not found or has no local file`);
  }

  const storagePath = exportVersionPath(task.projectId, version.versionNumber);
  await uploadFileToStorage(storagePath, version.localUri, 'video/mp4');
  await localRepositories.exportVersions.update(version.id, { remoteUri: storagePath, syncStatus: 'uploaded' });
}

async function uploadMetadataTask(task: SyncQueueTask): Promise<void> {
  const project = await localRepositories.projects.getById(task.projectId);
  if (!project) throw new Error(`Project ${task.projectId} not found`);

  const [tracks, clips, assets, exportVersions] = await Promise.all([
    localRepositories.tracks.listByProject(task.projectId),
    localRepositories.clips.listByProject(task.projectId, { includeHidden: true }),
    localRepositories.assets.listByProject(task.projectId),
    localRepositories.exportVersions.listByProject(task.projectId),
  ]);

  const snapshot = buildProjectMetadataSnapshot({
    project,
    tracks,
    clips,
    assets,
    exportVersions,
    now: new Date().toISOString(),
  });

  await uploadJsonToStorage(metadataPath(task.projectId), snapshot);
}

async function finalizeProjectSyncIfDone(projectId: string): Promise<void> {
  const project = await localRepositories.projects.getById(projectId);
  if (!project || project.status !== 'syncing') return;

  const tasks = await localRepositories.syncQueue.listByProject(projectId);
  const outcome = resolveSyncOutcome(tasks);
  if (outcome === 'in_progress') return;

  const now = new Date().toISOString();
  await localRepositories.projects.update(projectId, { status: outcome, updatedAt: now });
  if (outcome === 'synced') {
    await logEvent(projectId, 'BackupCompleted', {});
  }
}
