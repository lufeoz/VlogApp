// Phase 2/3 will consume this; Phase 1 only creates the schema, no producer/consumer logic.
export type AiJobType =
  | 'subtitle_generation'
  | 'music_generation'
  | 'narration'
  | 'highlight_detection'
  | 'edit_existing_video';

export interface AiJob {
  id: string;
  projectId: string;
  type: AiJobType;
  status: 'queued' | 'running' | 'completed' | 'failed';
  progress: number;
  priority: number;
  workerVersion: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  result: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}
