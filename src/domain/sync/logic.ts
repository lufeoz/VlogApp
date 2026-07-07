import { SyncQueueTask } from './types';

export type SyncOutcome = 'synced' | 'error' | 'in_progress';

// Decides what a project's status should become once its sync queue tasks
// are inspected. `error` only when something is permanently exhausted
// (status: 'failed') — a task still eligible for retry keeps the project in
// `syncing`, not `error`.
export function resolveSyncOutcome(tasks: SyncQueueTask[]): SyncOutcome {
  if (tasks.some((task) => task.status === 'pending' || task.status === 'in_progress')) {
    return 'in_progress';
  }
  if (tasks.some((task) => task.status === 'failed')) {
    return 'error';
  }
  return 'synced';
}
