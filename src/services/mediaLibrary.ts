import * as MediaLibrary from 'expo-media-library';

// Namespace import (not `{ Asset }`) so this doesn't collide with our own
// domain Asset type when both are imported in the same file elsewhere.
export async function saveVideoToPhotoLibrary(localUri: string): Promise<void> {
  const { status } = await MediaLibrary.requestPermissionsAsync();
  if (status !== 'granted') {
    throw new Error('Media library permission not granted');
  }
  await MediaLibrary.Asset.create(localUri);
}
