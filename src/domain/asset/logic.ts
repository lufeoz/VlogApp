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
