import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { localRepositories } from '../database';
import { EventLogEntry, EventType } from '../domain/event/types';
import { generateId } from './id';

// Every important action logs through here so appVersion/osVersion/deviceTime
// are captured consistently (architecture doc v4.1 §1.6, §1.8).
export async function logEvent(
  projectId: string,
  type: EventType,
  payload: Record<string, unknown>
): Promise<void> {
  const now = new Date().toISOString();
  const entry: EventLogEntry = {
    id: generateId(),
    projectId,
    type,
    payload,
    deviceTime: now,
    appVersion: Constants.expoConfig?.version ?? 'unknown',
    osVersion: `${Platform.OS} ${Platform.Version}`,
    createdAt: now,
  };
  await localRepositories.events.append(entry);
}
