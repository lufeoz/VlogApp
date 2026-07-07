import { createAudioPlayer } from 'expo-audio';

const PROBE_TIMEOUT_MS = 10000;

// expo-audio has no promise-based "wait until loaded" API — only an event
// (`playbackStatusUpdate`) that fires once `isLoaded`/`duration` are populated.
export function getAudioDurationMs(localUri: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const player = createAudioPlayer(localUri);

    const timeout = setTimeout(() => {
      subscription.remove();
      player.release();
      reject(new Error('오디오 길이를 확인하지 못했습니다 (시간 초과)'));
    }, PROBE_TIMEOUT_MS);

    const subscription = player.addListener('playbackStatusUpdate', (status) => {
      if (!status.isLoaded || status.duration <= 0) return;
      clearTimeout(timeout);
      subscription.remove();
      const durationMs = Math.round(status.duration * 1000);
      player.release();
      resolve(durationMs);
    });
  });
}
