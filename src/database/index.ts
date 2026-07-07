import { createAiJobRepository } from './aiJobRepository';
import { createAssetRepository } from './assetRepository';
import { createCaptionCueRepository } from './captionCueRepository';
import { createClipRepository } from './clipRepository';
import { createEventRepository } from './eventRepository';
import { createExportVersionRepository } from './exportVersionRepository';
import { createProjectRepository } from './projectRepository';
import { createSyncQueueRepository } from './syncQueueRepository';
import { createTrackRepository } from './trackRepository';

export { getDatabase } from './schema';

// Single composition point for all local (SQLite) repository implementations.
// services/ import from here, never from an individual repository file directly.
export const localRepositories = {
  projects: createProjectRepository(),
  tracks: createTrackRepository(),
  assets: createAssetRepository(),
  clips: createClipRepository(),
  exportVersions: createExportVersionRepository(),
  syncQueue: createSyncQueueRepository(),
  aiJobs: createAiJobRepository(),
  events: createEventRepository(),
  captionCues: createCaptionCueRepository(),
};
