import { MediaType, Resolution, SyncStatus } from '../shared/types';

// Asset represents the original recorded media. It is immutable — the only
// fields ever updated post-creation are remoteUri/syncStatus once backed up.
// Never edit Asset. All editing decisions live on Clip.
export interface Asset {
  id: string;
  projectId: string;
  mediaType: MediaType;
  localUri: string;
  remoteUri: string | null;
  duration: number;
  fps: number;
  resolution: Resolution;
  thumbnailUri: string;
  posterFrameUri: string;
  syncStatus: SyncStatus;
  createdAt: string;
}
