import { localRepositories } from '../database';
import { AiJob } from '../domain/aiJob/types';
import { CaptionCue } from '../domain/caption/types';
import { fetchAiJobFromRemote, pushAiJobToRemote } from '../remote/aiJobRemote';
import { ensureAuthenticated, supabase } from '../remote/supabaseClient';
import { generateId } from './id';

interface SubtitleSegment {
  text: string;
  startMs: number;
  endMs: number;
}

interface SubtitleJobResult {
  exportVersionId: string;
  segments: SubtitleSegment[];
}

// Requires the project's latest export to already be backed up (M4) — the
// Edge Function reads the video from Supabase Storage; it has no access to
// the device's local file.
export async function requestSubtitleGeneration(projectId: string): Promise<string> {
  const project = await localRepositories.projects.getById(projectId);
  if (!project?.latestVersionId) {
    throw new Error('먼저 영상을 내보내주세요.');
  }
  const version = await localRepositories.exportVersions.getById(project.latestVersionId);
  if (!version || version.syncStatus !== 'uploaded' || !version.remoteUri) {
    throw new Error('백업이 완료된 후 자막을 생성할 수 있습니다.');
  }

  const userId = await ensureAuthenticated();
  const now = new Date().toISOString();
  const job: AiJob = {
    id: generateId(),
    projectId,
    type: 'subtitle_generation',
    status: 'queued',
    progress: 0,
    priority: 0,
    workerVersion: null,
    startedAt: null,
    finishedAt: null,
    result: null,
    createdAt: now,
    updatedAt: now,
  };

  await localRepositories.aiJobs.create(job);
  await pushAiJobToRemote(job, userId);

  const { error } = await supabase.functions.invoke('generate-subtitles', {
    body: { aiJobId: job.id, exportVersionId: version.id },
  });
  if (error) throw new Error(`자막 생성 요청 실패: ${error.message}`);

  return job.id;
}

// Polls the Supabase row (server-authoritative for this entity) and, once
// completed, materializes the transcript into local CaptionCue rows.
export async function pollSubtitleJob(aiJobId: string): Promise<AiJob> {
  const job = await fetchAiJobFromRemote(aiJobId);
  await localRepositories.aiJobs.update(aiJobId, job);

  if (job.status === 'completed' && job.result) {
    await materializeCaptions(job);
  }

  return job;
}

async function materializeCaptions(job: AiJob): Promise<void> {
  const result = job.result as unknown as SubtitleJobResult | null;
  if (!result?.segments || result.segments.length === 0) return;

  let captionTrack = await localRepositories.tracks.getByProjectAndType(job.projectId, 'caption');
  if (!captionTrack) {
    captionTrack = {
      id: generateId(),
      projectId: job.projectId,
      type: 'caption',
      orderIndex: 1,
      createdAt: new Date().toISOString(),
    };
    await localRepositories.tracks.create(captionTrack);
  }

  // Regenerating replaces the previous transcript rather than appending.
  await localRepositories.captionCues.deleteByProject(job.projectId);

  const now = new Date().toISOString();
  for (const [index, segment] of result.segments.entries()) {
    const cue: CaptionCue = {
      id: generateId(),
      projectId: job.projectId,
      trackId: captionTrack.id,
      exportVersionId: result.exportVersionId,
      text: segment.text,
      startMs: segment.startMs,
      endMs: segment.endMs,
      orderIndex: index,
      createdAt: now,
    };
    await localRepositories.captionCues.create(cue);
  }
}

export async function listProjectCaptions(projectId: string): Promise<CaptionCue[]> {
  return localRepositories.captionCues.listByProject(projectId);
}
