import { Asset } from '../asset/types';
import { Clip } from '../clip/types';
import { Project } from '../project/types';
import { Track } from '../track/types';
import { CompositionItem, CompositionSpec, CompositionTrack, VideoCompositionItem } from './types';

export interface ClipWithAsset {
  clip: Clip;
  asset: Asset;
}

// Builds the native module's input from the current state of a project's
// video track. Only `visible` clips participate — hidden ones stay in the
// database (non-destructive) but are excluded from composition entirely.
// Phase 1 always emits a single video track; audio/caption tracks are part of
// the type (architecture doc v4.1 §1/§2) but nothing produces them yet.
export function buildCompositionSpec(
  project: Project,
  videoTrack: Track,
  videoClips: ClipWithAsset[]
): CompositionSpec {
  const items: CompositionItem[] = videoClips
    .filter(({ clip }) => clip.visibility === 'visible')
    .sort((a, b) => a.clip.orderIndex - b.clip.orderIndex)
    .map(
      ({ clip, asset }): VideoCompositionItem => ({
        kind: 'video',
        clipId: clip.id,
        sourceUri: asset.localUri,
        mediaType: asset.mediaType,
        trimStart: clip.trimStart,
        trimEnd: clip.trimEnd,
        transitionIn: null,
        effects: clip.effects,
        rotation: clip.rotation,
        crop: clip.crop,
        transform: clip.transform,
      })
    );

  if (items.length === 0) {
    throw new Error('Cannot export a project with no visible clips');
  }

  const track: CompositionTrack = { trackId: videoTrack.id, type: videoTrack.type, items };

  return {
    aspectRatio: project.settings.aspectRatio,
    fps: project.settings.fps,
    exportQuality: project.settings.exportQuality,
    tracks: [track],
  };
}
