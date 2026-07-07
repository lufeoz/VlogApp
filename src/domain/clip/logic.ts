import { Clip } from './types';

// A freshly recorded clip is untrimmed (spans the full asset) and unedited.
export function buildRecordedClip(params: {
  id: string;
  projectId: string;
  trackId: string;
  assetId: string;
  orderIndex: number;
  durationMs: number;
  now: string;
}): Clip {
  return {
    id: params.id,
    projectId: params.projectId,
    trackId: params.trackId,
    assetId: params.assetId,
    orderIndex: params.orderIndex,
    trimStart: 0,
    trimEnd: params.durationMs,
    effects: [],
    rotation: 0,
    crop: null,
    transform: null,
    visibility: 'visible',
    deletedAt: null,
    createdAt: params.now,
    updatedAt: params.now,
  };
}

export const MIN_CLIP_DURATION_MS = 200;

export interface ReorderAssignment {
  clipId: string;
  orderIndex: number;
}

// `orderedClipIds` must be exactly the set of currently-visible clip ids of the
// track, in their new desired order — hidden clips are left untouched (see
// restoreClip below for why hidden clips don't participate in ordering).
export function computeReorder(visibleClips: Clip[], orderedClipIds: string[]): ReorderAssignment[] {
  const currentIds = new Set(visibleClips.map((c) => c.id));
  const isValidPermutation =
    orderedClipIds.length === visibleClips.length && orderedClipIds.every((id) => currentIds.has(id));
  if (!isValidPermutation) {
    throw new Error('orderedClipIds must be exactly the visible clips of the track');
  }
  return orderedClipIds.map((clipId, orderIndex) => ({ clipId, orderIndex }));
}

export function computeTrim(
  assetDurationMs: number,
  trimStart: number,
  trimEnd: number
): { trimStart: number; trimEnd: number } {
  if (trimStart < 0) throw new Error('trimStart must be >= 0');
  if (trimEnd > assetDurationMs) throw new Error('trimEnd must not exceed the source asset duration');
  if (trimEnd - trimStart < MIN_CLIP_DURATION_MS) {
    throw new Error(`trimmed clip must be at least ${MIN_CLIP_DURATION_MS}ms`);
  }
  return { trimStart, trimEnd };
}

export function hideClip(now: string): Pick<Clip, 'visibility' | 'deletedAt'> {
  return { visibility: 'hidden', deletedAt: now };
}

// Restoring always appends at the end of the currently-visible order rather
// than trying to reinstate its pre-hide position, which could now collide
// with whatever clip occupies that index — see architecture doc v4.1 §1.5
// reasoning on keeping ordering simple.
export function restoreClip(newOrderIndex: number): Pick<Clip, 'visibility' | 'deletedAt' | 'orderIndex'> {
  return { visibility: 'visible', deletedAt: null, orderIndex: newOrderIndex };
}
