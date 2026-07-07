import * as VideoThumbnails from 'expo-video-thumbnails';

// expo-video-thumbnails is deprecated in SDK 57 in favor of expo-video's
// generateThumbnailsAsync, but that replacement only returns an in-memory
// native image ref (no persistable URI) — unsuitable for Asset.thumbnailUri/
// posterFrameUri, which must be storable strings. Isolated here on purpose:
// swapping the implementation later is a one-file change, not architectural.
export async function generateSingleThumbnail(localUri: string, timeMs: number): Promise<string> {
  const result = await VideoThumbnails.getThumbnailAsync(localUri, { time: timeMs });
  return result.uri;
}

export interface ThumbnailSet {
  thumbnailUri: string;
  posterFrameUri: string;
}

export async function generateThumbnails(localUri: string, durationMs: number): Promise<ThumbnailSet> {
  const thumbnailUri = await generateSingleThumbnail(localUri, 0);

  const posterTimeMs = Math.max(0, Math.min(Math.floor(durationMs / 2), Math.max(durationMs - 100, 0)));
  const posterFrameUri = await generateSingleThumbnail(localUri, posterTimeMs);

  return { thumbnailUri, posterFrameUri };
}
