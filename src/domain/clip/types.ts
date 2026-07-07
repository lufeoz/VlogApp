import { CropSpec, EffectSpec, TransformSpec } from '../shared/types';

// Clip is a timeline instance referencing an Asset. It stores only editing
// decisions (order, trim, effects, visibility) — never the media itself.
// duration is intentionally NOT stored here: it's derived as trimEnd - trimStart
// to avoid a second source of truth alongside Asset.duration.
export interface Clip {
  id: string;
  projectId: string; // denormalized for query performance, see architecture doc §2
  trackId: string;
  assetId: string;
  orderIndex: number;
  trimStart: number;
  trimEnd: number;
  effects: EffectSpec[];
  rotation: number;
  crop: CropSpec | null;
  transform: TransformSpec | null;
  visibility: 'visible' | 'hidden';
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
