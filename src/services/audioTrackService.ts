import { localRepositories } from '../database';
import { buildAudioAsset } from '../domain/asset/logic';
import { buildRecordedClip } from '../domain/clip/logic';
import { generateId } from './id';

// Adds an already-local audio file as a Clip on the project's single `audio`
// track (created on first use). Shared by narration and background-music
// features (aiService.ts, musicService.ts) — Media3/AVFoundation mix every
// item on an audio track independently regardless of which feature produced
// it (see native video-composer notes), so both can coexist as separate
// clips on the same track without needing separate track "slots".
export async function addAudioClipFromLocalFile(
  projectId: string,
  localUri: string,
  durationMs: number
): Promise<void> {
  let audioTrack = await localRepositories.tracks.getByProjectAndType(projectId, 'audio');
  if (!audioTrack) {
    audioTrack = {
      id: generateId(),
      projectId,
      type: 'audio',
      orderIndex: 2,
      createdAt: new Date().toISOString(),
    };
    await localRepositories.tracks.create(audioTrack);
  }

  const now = new Date().toISOString();
  const asset = buildAudioAsset({
    id: generateId(),
    projectId,
    localUri,
    durationMs,
    thumbnailUri: '',
    now,
  });
  await localRepositories.assets.create(asset);

  const existingClips = await localRepositories.clips.listByTrack(audioTrack.id, { includeHidden: true });
  const clip = buildRecordedClip({
    id: generateId(),
    projectId,
    trackId: audioTrack.id,
    assetId: asset.id,
    orderIndex: existingClips.length,
    durationMs,
    now,
  });
  await localRepositories.clips.create(clip);
}
