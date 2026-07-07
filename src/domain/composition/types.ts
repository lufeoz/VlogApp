import { CropSpec, EffectSpec, MediaType, TrackType, TransformSpec, TransitionSpec } from '../shared/types';

// Phase 1 native implementations ignore transitionIn/effects/rotation/crop/transform —
// they are part of the public contract now so the interface never needs to change
// when those features are implemented later (architecture doc v4.1 §1).
export interface VideoCompositionItem {
  kind: 'video';
  clipId: string;
  sourceUri: string;
  mediaType: MediaType;
  trimStart: number;
  trimEnd: number;
  transitionIn?: TransitionSpec | null;
  effects?: EffectSpec[];
  rotation?: number;
  crop?: CropSpec | null;
  transform?: TransformSpec | null;
}

export interface AudioCompositionItem {
  kind: 'audio';
  clipId: string;
  sourceUri: string;
  trimStart: number;
  trimEnd: number;
  volume?: number;
  fadeInMs?: number;
  fadeOutMs?: number;
}

export interface CaptionCompositionItem {
  kind: 'caption';
  cueId: string;
  text: string;
  startMs: number;
  endMs: number;
  style?: Record<string, unknown>;
}

export type CompositionItem = VideoCompositionItem | AudioCompositionItem | CaptionCompositionItem;

export interface CompositionTrack {
  trackId: string;
  type: TrackType;
  items: CompositionItem[];
}

export interface CompositionSpec {
  aspectRatio: '9:16' | '16:9' | '1:1';
  fps: number;
  exportQuality: string;
  tracks: CompositionTrack[];
}
