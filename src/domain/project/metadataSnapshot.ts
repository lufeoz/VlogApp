import { Asset } from '../asset/types';
import { Clip } from '../clip/types';
import { ExportVersion } from '../exportVersion/types';
import { Track } from '../track/types';
import { Project } from './types';

// What goes into projects/{projectId}/metadata.json (architecture doc v4.1 §5).
export interface ProjectMetadataSnapshot {
  project: Project;
  tracks: Track[];
  clips: Clip[];
  assets: Asset[];
  exportVersions: ExportVersion[];
  generatedAt: string;
}

export function buildProjectMetadataSnapshot(params: {
  project: Project;
  tracks: Track[];
  clips: Clip[];
  assets: Asset[];
  exportVersions: ExportVersion[];
  now: string;
}): ProjectMetadataSnapshot {
  return {
    project: params.project,
    tracks: params.tracks,
    clips: params.clips,
    assets: params.assets,
    exportVersions: params.exportVersions,
    generatedAt: params.now,
  };
}
