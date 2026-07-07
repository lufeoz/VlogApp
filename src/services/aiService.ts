import { localRepositories } from '../database';
import { AiJob, AiJobType } from '../domain/aiJob/types';
import { CaptionCue } from '../domain/caption/types';
import { fetchAiJobFromRemote, pushAiJobToRemote } from '../remote/aiJobRemote';
import { thumbnailPath } from '../remote/storagePaths';
import { downloadFileFromStorage } from '../remote/storageDownload';
import { ensureAuthenticated, supabase } from '../remote/supabaseClient';
import { addAudioClipFromLocalFile } from './audioTrackService';
import { getAudioDurationMs } from './audioDuration';
import { generateId } from './id';
import { getProjectDetail } from './projectService';

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

  return createAndDispatchAiJob(projectId, 'subtitle_generation', 'generate-subtitles', {
    exportVersionId: version.id,
  });
}

// Polls the Supabase row (server-authoritative for this entity) and, once
// completed, materializes the transcript into local CaptionCue rows.
//
// Guards against overlapping poll ticks (e.g. a slow network response still
// in flight when the next 3s tick fires) by checking the LOCAL job's status
// *before* this tick's update: if a previous tick already observed
// `completed`, this one skips re-materializing. This narrows — doesn't fully
// eliminate — the duplicate-write race for truly concurrent calls, which is
// an accepted low-probability edge case elsewhere in this app (see M4 review).
export async function pollSubtitleJob(aiJobId: string): Promise<AiJob> {
  const wasAlreadyCompleted = (await localRepositories.aiJobs.getById(aiJobId))?.status === 'completed';

  const job = await fetchAiJobFromRemote(aiJobId);
  await localRepositories.aiJobs.update(aiJobId, job);

  if (job.status === 'completed' && job.result && !wasAlreadyCompleted) {
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

interface GeneratedAudioJobResult {
  storagePath: string;
}

async function createAndDispatchAiJob(
  projectId: string,
  type: AiJobType,
  functionName: string,
  body: Record<string, unknown>
): Promise<string> {
  const userId = await ensureAuthenticated();
  const now = new Date().toISOString();
  const job: AiJob = {
    id: generateId(),
    projectId,
    type,
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

  const { error } = await supabase.functions.invoke(functionName, { body: { aiJobId: job.id, ...body } });
  if (error) throw new Error(`AI 작업 요청 실패: ${error.message}`);

  return job.id;
}

// Downloads the generated narration audio to local storage and adds it as a
// Clip on the project's `audio` track (see audioTrackService.ts).
async function materializeGeneratedAudioClip(job: AiJob, fileNamePrefix: string): Promise<void> {
  const result = job.result as unknown as GeneratedAudioJobResult | null;
  if (!result?.storagePath) return;

  const localUri = await downloadFileFromStorage(result.storagePath, `${fileNamePrefix}-${job.id}.mp3`);
  const durationMs = await getAudioDurationMs(localUri);
  await addAudioClipFromLocalFile(job.projectId, localUri, durationMs);
}

export async function requestNarrationGeneration(projectId: string, script: string): Promise<string> {
  if (!script.trim()) throw new Error('내레이션 대본을 입력해주세요.');
  return createAndDispatchAiJob(projectId, 'narration', 'generate-narration', { projectId, text: script });
}

// See pollSubtitleJob for why this checks local status first — here it
// matters more, since re-materializing would add a *duplicate* audio clip
// rather than just redundantly rewriting the same rows.
export async function pollNarrationJob(aiJobId: string): Promise<AiJob> {
  const wasAlreadyCompleted = (await localRepositories.aiJobs.getById(aiJobId))?.status === 'completed';

  const job = await fetchAiJobFromRemote(aiJobId);
  await localRepositories.aiJobs.update(aiJobId, job);

  if (job.status === 'completed' && job.result && !wasAlreadyCompleted) {
    await materializeGeneratedAudioClip(job, 'narration');
  }

  return job;
}

export interface HighlightRecommendation {
  clipId: string;
  score: number;
  reason: string;
  suggestion: 'keep' | 'hide';
}

interface HighlightJobResult {
  recommendations: HighlightRecommendation[];
}

// Advisory only — nothing is auto-applied. Requires every visible clip's
// Asset to already be backed up (M4), since the Edge Function only has
// access to Supabase Storage, not the device's local files; reuses the
// thumbnail already uploaded by UPLOAD_CLIP rather than uploading anything new.
export async function requestHighlightDetection(projectId: string): Promise<string> {
  const detail = await getProjectDetail(projectId);
  if (!detail) throw new Error(`Project ${projectId} not found`);
  if (detail.visibleClips.length === 0) {
    throw new Error('분석할 클립이 없습니다.');
  }
  if (detail.visibleClips.some(({ asset }) => asset.syncStatus !== 'uploaded')) {
    throw new Error('백업이 완료된 후 하이라이트 추천을 받을 수 있습니다.');
  }

  const clips = detail.visibleClips.map(({ clip, asset }) => ({
    clipId: clip.id,
    thumbnailStoragePath: thumbnailPath(projectId, asset.id),
  }));

  return createAndDispatchAiJob(projectId, 'highlight_detection', 'detect-highlights', { clips });
}

export async function pollHighlightJob(aiJobId: string): Promise<AiJob> {
  const job = await fetchAiJobFromRemote(aiJobId);
  await localRepositories.aiJobs.update(aiJobId, job);
  return job;
}

export function getHighlightRecommendations(job: AiJob): HighlightRecommendation[] {
  const result = job.result as unknown as HighlightJobResult | null;
  return result?.recommendations ?? [];
}
