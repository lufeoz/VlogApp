import { CompositionSpec } from '../composition/types';
import { ProjectSettings } from '../project/types';
import { ExportVersion } from './types';

// A freshly started export: no output yet, snapshots are already frozen
// (architecture doc v4.1 amendment — settingsSnapshot alongside compositionSnapshot
// so this version stays reproducible even if Project.settings changes later).
export function buildPendingExportVersion(params: {
  id: string;
  projectId: string;
  versionNumber: number;
  compositionSnapshot: CompositionSpec;
  settingsSnapshot: ProjectSettings;
  now: string;
}): ExportVersion {
  return {
    id: params.id,
    projectId: params.projectId,
    versionNumber: params.versionNumber,
    localUri: null,
    remoteUri: null,
    thumbnailUri: null,
    status: 'exporting',
    compositionSnapshot: params.compositionSnapshot,
    settingsSnapshot: params.settingsSnapshot,
    syncStatus: 'pending',
    createdAt: params.now,
    completedAt: null,
  };
}
