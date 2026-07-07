// Project-scoped storage layout (architecture doc v4.1 §5). Never use a global
// clips folder — every path is namespaced under its owning project.
export const STORAGE_BUCKET = 'vlog-projects';

export function assetClipPath(projectId: string, assetId: string): string {
  return `projects/${projectId}/clips/${assetId}.mp4`;
}

export function exportVersionPath(projectId: string, versionNumber: number): string {
  return `projects/${projectId}/exports/${versionNumber}.mp4`;
}

export function thumbnailPath(projectId: string, assetId: string): string {
  return `projects/${projectId}/thumbnails/${assetId}.jpg`;
}

export function metadataPath(projectId: string): string {
  return `projects/${projectId}/metadata.json`;
}
