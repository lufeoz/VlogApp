import { Resolution } from '../shared/types';

export type ProjectStatus =
  | 'draft'
  | 'editing'
  | 'exporting'
  | 'completed'
  | 'syncing'
  | 'synced'
  | 'error';

export interface ProjectSettings {
  aspectRatio: '9:16' | '16:9' | '1:1';
  fps: number;
  exportQuality: string;
  resolution: Resolution;
  defaultClipDuration: number;
  [key: string]: unknown;
}

export interface Project {
  id: string;
  title: string;
  date: string;
  status: ProjectStatus;
  settings: ProjectSettings;
  coverImageUri: string | null;
  latestVersionId: string | null;
  publishedVersionId: string | null;
  createdAt: string;
  updatedAt: string;
}
