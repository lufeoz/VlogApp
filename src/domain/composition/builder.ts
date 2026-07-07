import { Asset } from '../asset/types';
import { Clip } from '../clip/types';
import { Project } from '../project/types';
import { Track } from '../track/types';
import {
  AudioCompositionItem,
  CompositionSpec,
  CompositionTrack,
  VideoCompositionItem,
} from './types';

export interface ClipWithAsset {
  clip: Clip;
  asset: Asset;
}

export interface TrackWithClips {
  track: Track;
  clips: ClipWithAsset[];
}

// Builds the native module's input from the current state of every track in
// a project. Only `visible` clips participate — hidden ones stay in the
// database (non-destructive) but are excluded from composition entirely.
// Caption tracks are not composed here — the native module doesn't render
// captions yet (M3 decision); CaptionCue is text+timing only, not Asset-based,
// so it has no natural CompositionItem mapping until that lands.
export function buildCompositionSpec(project: Project, tracksWithClips: TrackWithClips[]): CompositionSpec {
  const compositionTracks: CompositionTrack[] = [];

  for (const { track, clips } of tracksWithClips) {
    const visibleClips = clips
      .filter(({ clip }) => clip.visibility === 'visible')
      .sort((a, b) => a.clip.orderIndex - b.clip.orderIndex);
    if (visibleClips.length === 0) continue;

    if (track.type === 'video') {
      const items: VideoCompositionItem[] = visibleClips.map(({ clip, asset }) => ({
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
      }));
      compositionTracks.push({ trackId: track.id, type: track.type, items });
    } else if (track.type === 'audio') {
      const items: AudioCompositionItem[] = visibleClips.map(({ clip, asset }) => ({
        kind: 'audio',
        clipId: clip.id,
        sourceUri: asset.localUri,
        trimStart: clip.trimStart,
        trimEnd: clip.trimEnd,
      }));
      compositionTracks.push({ trackId: track.id, type: track.type, items });
    }
  }

  if (!compositionTracks.some((track) => track.type === 'video')) {
    throw new Error('Cannot export a project with no visible clips');
  }

  return {
    aspectRatio: project.settings.aspectRatio,
    fps: project.settings.fps,
    exportQuality: project.settings.exportQuality,
    tracks: compositionTracks,
  };
}
