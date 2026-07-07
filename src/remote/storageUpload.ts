import { File } from 'expo-file-system';

import { STORAGE_BUCKET } from './storagePaths';
import { supabase } from './supabaseClient';

// expo-file-system's modern File class exposes bytes() (Uint8Array), which
// supabase-js's upload() accepts directly as an ArrayBufferView — no base64
// round-trip needed (that was the legacy expo-file-system API's only option).
export async function uploadFileToStorage(
  storagePath: string,
  localUri: string,
  contentType: string
): Promise<void> {
  const bytes = await new File(localUri).bytes();

  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, bytes, { contentType, upsert: true });

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
