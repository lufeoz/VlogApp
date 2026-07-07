import { localRepositories } from '../database';
import { isExportStale, isSyncTaskStale } from '../domain/recovery/logic';
import { logEvent } from './eventLogger';
import { processSyncQueue } from './syncService';

// Runs on app launch and on foreground resume (architecture doc v4.1 §9).
// Export recovery is always "retry from scratch" — composeAsync is a pure
// function of its CompositionSpec, so there's nothing to resume. This only
// unsticks the status (exporting -> error) so the existing "완료" button
// becomes usable again; the user re-triggers the export themselves.
// Sync recovery resets crashed in_progress uploads back to pending, then a
// normal drain picks them up (along with anything already pending).
export async function recoverInterruptedWork(): Promise<void> {
  const now = new Date();
  const nowIso = now.toISOString();

  const exportingProjects = await localRepositories.projects.listByStatus('exporting');
  for (const project of exportingProjects) {
    if (!isExportStale(project, now)) continue;
    await localRepositories.projects.update(project.id, { status: 'error', updatedAt: nowIso });
    await logEvent(project.id, 'ExportFailed', { reason: 'interrupted' });
  }

  const inProgressTasks = await localRepositories.syncQueue.listInProgress();
  for (const task of inProgressTasks) {
    if (!isSyncTaskStale(task, now)) continue;
    await localRepositories.syncQueue.update(task.taskId, { status: 'pending', updatedAt: nowIso });
  }

  // Fire-and-forget: don't block app startup/foreground-resume on network I/O.
  processSyncQueue().catch((error) => {
    console.error('Recovery sync drain failed', error);
  });
}
