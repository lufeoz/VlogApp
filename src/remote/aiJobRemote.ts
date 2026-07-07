import { AiJob } from '../domain/aiJob/types';
import { supabase } from './supabaseClient';

interface AiJobRow {
  id: string;
  project_id: string;
  type: string;
  status: string;
  progress: number;
  priority: number;
  worker_version: string | null;
  started_at: string | null;
  finished_at: string | null;
  result: unknown;
  created_at: string;
  updated_at: string;
}

function toDomain(row: AiJobRow): AiJob {
  return {
    id: row.id,
    projectId: row.project_id,
    type: row.type as AiJob['type'],
    status: row.status as AiJob['status'],
    progress: row.progress,
    priority: row.priority,
    workerVersion: row.worker_version,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    result: (row.result as Record<string, unknown> | null) ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// AiJob is the one entity where Supabase — not local SQLite — is the live
// source of truth while work is in flight: the actual processing runs
// server-side in an Edge Function, which can only reach the Postgres row,
// never the device's local database. See services/aiService.ts.
export async function pushAiJobToRemote(job: AiJob, userId: string): Promise<void> {
  const { error } = await supabase.from('ai_jobs').upsert({
    id: job.id,
    user_id: userId,
    project_id: job.projectId,
    type: job.type,
    status: job.status,
    progress: job.progress,
    priority: job.priority,
    worker_version: job.workerVersion,
    started_at: job.startedAt,
    finished_at: job.finishedAt,
    result: job.result,
    created_at: job.createdAt,
    updated_at: job.updatedAt,
  });
  if (error) throw new Error(`Failed to push AI job: ${error.message}`);
}

export async function fetchAiJobFromRemote(aiJobId: string): Promise<AiJob> {
  const { data, error } = await supabase.from('ai_jobs').select('*').eq('id', aiJobId).single();
  if (error || !data) throw new Error(`Failed to fetch AI job: ${error?.message ?? 'not found'}`);
  return toDomain(data as AiJobRow);
}
