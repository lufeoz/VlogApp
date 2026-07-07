export type SyncTaskType = 'UPLOAD_CLIP' | 'UPLOAD_EXPORT' | 'UPLOAD_METADATA';
export type SyncTaskStatus = 'pending' | 'in_progress' | 'completed' | 'failed';

export interface SyncQueueTask {
  taskId: string;
  projectId: string;
  targetId: string; // assetId or exportVersionId being uploaded
  type: SyncTaskType;
  status: SyncTaskStatus;
  priority: number; // higher = more urgent. UPLOAD_EXPORT > UPLOAD_METADATA > UPLOAD_CLIP
  retryCount: number;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

// Task priorities per architecture doc v4.1 §1.6 — finished export is the
// most valuable thing to protect first, raw originals are the least urgent.
export const SYNC_TASK_PRIORITY: Record<SyncTaskType, number> = {
  UPLOAD_EXPORT: 2,
  UPLOAD_METADATA: 1,
  UPLOAD_CLIP: 0,
};

export const SYNC_MAX_RETRY_COUNT = 5;
