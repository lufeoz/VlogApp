import { CompositionSpec } from '../composition/types';
import { ProjectSettings } from '../project/types';
import { SyncStatus } from '../shared/types';

// Every export creates a new immutable version; exports are never overwritten.
// compositionSnapshot + settingsSnapshot together make each version fully
// self-describing and reproducible even after Project.settings changes later.
export interface ExportVersion {
  id: string;
  projectId: string;
  versionNumber: number;
  localUri: string | null;
  remoteUri: string | null;
  thumbnailUri: string | null;
  status: 'pending' | 'exporting' | 'completed' | 'failed';
  compositionSnapshot: CompositionSpec;
  settingsSnapshot: ProjectSettings;
  syncStatus: SyncStatus;
  createdAt: string;
  completedAt: string | null;
}
