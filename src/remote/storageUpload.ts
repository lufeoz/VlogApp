import { decode } from 'base64-arraybuffer';
import * as FileSystem from 'expo-file-system';

import { STORAGE_BUCKET } from './storagePaths';
import { supabase } from './supabaseClient';

// supabase-js's upload() doesn't accept a Blob/local file URI directly in
// React Native — the documented pattern is to read the file as base64 via
// expo-file-system and decode it into an ArrayBuffer first.
export async function uploadFileToStorage(
  storagePath: string,
  localUri: string,
  contentType: string
): Promise<void> {
  const base64 = await FileSystem.readAsStringAsync(localUri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const arrayBuffer = decode(base64);

  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, arrayBuffer, { contentType, upsert: true });

  if (error) {
    throw new Error(`Upload failed for ${storagePath}: ${error.message}`);
  }
}

export async function uploadJsonToStorage(storagePath: string, data: unknown): Promise<void> {
  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, JSON.stringify(data), { contentType: 'application/json', upsert: true });

  if (error) {
    throw new Error(`Upload failed for ${storagePath}: ${error.message}`);
  }
}
