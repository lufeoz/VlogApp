import { Directory, File, Paths } from 'expo-file-system';

import { STORAGE_BUCKET } from './storagePaths';
import { supabase } from './supabaseClient';

// Downloads a private-bucket object to local cache via a short-lived signed
// URL (the bucket has no public access — see supabase/schema.sql). Used for
// AI-generated audio (narration/music), which is produced server-side and
// must become a local file before it can be referenced by an Asset/Clip.
export async function downloadFileFromStorage(storagePath: string, localFileName: string): Promise<string> {
  const { data, error } = await supabase.storage.from(STORAGE_BUCKET).createSignedUrl(storagePath, 60);
  if (error || !data?.signedUrl) {
    throw new Error(`Failed to create signed URL for ${storagePath}: ${error?.message ?? 'unknown'}`);
  }

  const destinationDir = new Directory(Paths.cache, 'downloads');
  if (!destinationDir.exists) {
    destinationDir.create({ intermediates: true });
  }

  const file = await File.downloadFileAsync(data.signedUrl, new File(destinationDir, localFileName), {
    idempotent: true,
  });
  return file.uri;
}
