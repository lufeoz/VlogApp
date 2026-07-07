// Append-only event log. `type` is stored as free TEXT in the database (not a
// DB-level enum/CHECK constraint) so new event types are a pure additive change
// with zero migration cost — validation happens only at the TS layer here.
export type EventType =
  | 'ProjectCreated'
  | 'ClipRecorded'
  | 'ClipDeleted'
  | 'ClipRestored'
  | 'ClipReordered'
  | 'ClipTrimmed'
  | 'ClipTransformChanged' // reserved for rotation/crop/transform/effects edits; unused in Phase 1
  | 'ExportStarted'
  | 'ProjectExported'
  | 'ExportFailed'
  | 'VersionPublished'
  | 'BackupStarted'
  | 'BackupCompleted'
  | 'BackupFailed';

export interface EventLogEntry {
  id: string;
  projectId: string;
  type: EventType;
  payload: Record<string, unknown>;
  deviceTime: string;
  appVersion: string;
  osVersion: string;
  createdAt: string;
}
