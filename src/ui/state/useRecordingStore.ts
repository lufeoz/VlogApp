import { create } from 'zustand';

// Transient camera UI state only (architecture doc v4.1 §1.5 — this is
// exactly the kind of ephemeral "current session" state that stays in the UI
// layer rather than becoming a persisted RecordingSession entity).
interface RecordingState {
  isRecording: boolean;
  recordingStartedAt: number | null;
  start: () => void;
  stop: () => void;
}

export const useRecordingStore = create<RecordingState>((set) => ({
  isRecording: false,
  recordingStartedAt: null,
  start: () => set({ isRecording: true, recordingStartedAt: Date.now() }),
  stop: () => set({ isRecording: false, recordingStartedAt: null }),
}));
