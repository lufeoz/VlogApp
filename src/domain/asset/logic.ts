import { Resolution } from '../shared/types';
import { Asset } from './types';

export function buildRecordedAsset(params: {
  id: string;
  projectId: string;
  localUri: string;
  durationMs: number;
  fps: number;
  resolution: Resolution;
  thumbnailUri: string;
  posterFrameUri: string;
  now: string;
}): Asset {
  return {
    id: params.id,
    projectId: params.projectId,
    mediaType: 'video',
    localUri: params.localUri,
    remoteUri: null,
    duration: params.durationMs,
    fps: params.fps,
    resolution: params.resolution,
    thumbnailUri: params.thumbnailUri,
    posterFrameUri: params.posterFrameUri,
    syncStatus: 'pending',
    createdAt: params.now,
  };
}

// AI-generated audio (narration/music, Phase 2) has no meaningful fps or
// pixel resolution — these fields are Asset-wide because they're normally
// video properties; audio assets use zero/placeholder values rather than
// making them optional, which would touch the frozen Asset shape further.
export function buildAudioAsset(params: {
  id: string;
  projectId: string;
  localUri: string;
  durationMs: number;
  thumbnailUri: string;
  now: string;
}): Asset {
  return {
    id: params.id,
    projectId: params.projectId,
    mediaType: 'audio',
    localUri: params.localUri,
    remoteUri: null,
    duration: params.durationMs,
    fps: 0,
    resolution: { width: 0, height: 0 },
    thumbnailUri: params.thumbnailUri,
    posterFrameUri: params.thumbnailUri,
    syncStatus: 'pending',
    createdAt: params.now,
  };
}
