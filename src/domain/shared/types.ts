export type MediaType = 'video' | 'photo' | 'timelapse';
export type TrackType = 'video' | 'audio' | 'caption';
export type SyncStatus = 'pending' | 'uploaded' | 'failed';

export interface TransitionSpec {
  type: string;
  durationMs: number;
}

// Intentionally open-ended: any future effect is a new `type` string with a
// free-form params bag. See architecture doc v4.1 §1.10 — do not add
// stacking/order/scope fields until a real effect is being implemented.
export interface EffectSpec {
  type: string;
  params: Record<string, unknown>;
}

export interface CropSpec {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TransformSpec {
  scale?: number;
  translateX?: number;
  translateY?: number;
}

export interface Resolution {
  width: number;
  height: number;
}
