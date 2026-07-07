import { Project } from '../project/types';
import { SyncQueueTask } from '../sync/types';

// Thresholds per architecture doc v4.1 §9 — long enough that a normal export/
// upload in progress is never mistaken for stale, short enough that a crashed
// one is caught on the next launch/foreground check.
export const EXPORT_STALE_THRESHOLD_MS = 3 * 60 * 1000;
export const SYNC_STALE_THRESHOLD_MS = 5 * 60 * 1000;

export function isExportStale(project: Project, now: Date, thresholdMs = EXPORT_STALE_THRESHOLD_MS): boolean {
  if (project.status !== 'exporting') return false;
  return now.getTime() - new Date(project.updatedAt).getTime() > thresholdMs;
}

export function isSyncTaskStale(task: SyncQueueTask, now: Date, thresholdMs = SYNC_STALE_THRESHOLD_MS): boolean {
  if (task.status !== 'in_progress') return false;
  return now.getTime() - new Date(task.updatedAt).getTime() > thresholdMs;
}
