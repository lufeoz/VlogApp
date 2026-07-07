import { Directory, File, Paths } from 'expo-file-system';

import { localRepositories } from '../database';
import { AiJob } from '../domain/aiJob/types';
import { addAudioClipFromLocalFile } from './audioTrackService';
import { getAudioDurationMs } from './audioDuration';
import { generateId } from './id';

// "Free music" here means royalty-free stock music matched to the video's
// length, not generative AI — Jamendo's catalog is genuinely free (no paid
// API key), which fits the product's "무료" requirement better than a paid
// generative-audio API would. Read-only search needs only a client_id (no
// OAuth2 token), so this runs entirely client-side — no Edge Function/AiJob
// server round-trip needed, unlike subtitles/narration.
const JAMENDO_CLIENT_ID = process.env.EXPO_PUBLIC_JAMENDO_CLIENT_ID;
const DEFAULT_TARGET_DURATION_SEC = 120;

interface JamendoTrack {
  id: string;
  name: string;
  artist_name: string;
  audiodownload: string;
  license_ccurl: string;
}

interface JamendoSearchResponse {
  results: JamendoTrack[];
}

async function findTrackMatchingDuration(targetDurationSec: number): Promise<JamendoTrack> {
  if (!JAMENDO_CLIENT_ID) {
    throw new Error('무료 음악 검색 설정이 필요합니다 (EXPO_PUBLIC_JAMENDO_CLIENT_ID).');
  }

  const minSec = Math.max(20, Math.round(targetDurationSec * 0.7));
  const maxSec = Math.round(targetDurationSec * 1.5) + 30;
  const url =
    `https://api.jamendo.com/v3.0/tracks/?client_id=${JAMENDO_CLIENT_ID}&format=json&limit=1` +
    `&order=popularity_total&audiodownload_allowed=true&durationbetween=${minSec}_${maxSec}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`무료 음악 검색 실패: ${response.status}`);
  }
  const data: JamendoSearchResponse = await response.json();
  const track = data.results?.[0];
  if (!track) {
    throw new Error('조건에 맞는 무료 배경음악을 찾지 못했습니다.');
  }
  return track;
}

// Prefers matching the latest export's actual length; falls back to a
// reasonable default when no export exists yet (music can be added before
// the first export, same as narration).
async function resolveTargetDurationSec(projectId: string): Promise<number> {
  const project = await localRepositories.projects.getById(projectId);
  if (!project?.latestVersionId) return DEFAULT_TARGET_DURATION_SEC;

  const version = await localRepositories.exportVersions.getById(project.latestVersionId);
  if (!version?.localUri) return DEFAULT_TARGET_DURATION_SEC;

  try {
    const durationMs = await getAudioDurationMs(version.localUri);
    return durationMs / 1000;
  } catch {
    return DEFAULT_TARGET_DURATION_SEC;
  }
}

export async function requestBackgroundMusic(projectId: string): Promise<void> {
  const now = new Date().toISOString();
  const job: AiJob = {
    id: generateId(),
    projectId,
    type: 'music_generation',
    status: 'running',
    progress: 30,
    priority: 0,
    workerVersion: 'jamendo-v3',
    startedAt: now,
    finishedAt: null,
    result: null,
    createdAt: now,
    updatedAt: now,
  };
  await localRepositories.aiJobs.create(job);

  try {
    const targetDurationSec = await resolveTargetDurationSec(projectId);
    const track = await findTrackMatchingDuration(targetDurationSec);

    const destinationDir = new Directory(Paths.cache, 'downloads');
    if (!destinationDir.exists) {
      destinationDir.create({ intermediates: true });
    }
    const downloadedFile = await File.downloadFileAsync(
      track.audiodownload,
      new File(destinationDir, `music-${job.id}.mp3`),
      { idempotent: true }
    );

    const durationMs = await getAudioDurationMs(downloadedFile.uri);
    await addAudioClipFromLocalFile(projectId, downloadedFile.uri, durationMs);

    await localRepositories.aiJobs.update(job.id, {
      status: 'completed',
      progress: 100,
      result: { trackName: track.name, artistName: track.artist_name, licenseUrl: track.license_ccurl },
      finishedAt: new Date().toISOString(),
    });
  } catch (error) {
    await localRepositories.aiJobs.update(job.id, {
      status: 'failed',
      result: { error: error instanceof Error ? error.message : String(error) },
      finishedAt: new Date().toISOString(),
    });
    throw error;
  }
}
