import { TrackType } from '../shared/types';

export interface Track {
  id: string;
  projectId: string;
  type: TrackType;
  orderIndex: number;
  createdAt: string;
}
