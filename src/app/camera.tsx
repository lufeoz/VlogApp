import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { recordClip } from '../services/recordingService';
import { useRecordingStore } from '../ui/state/useRecordingStore';

// UI only: renders the camera and forwards the resulting file to
// recordingService. No project/asset/clip/event logic lives here.
export default function CameraScreen() {
  const cameraRef = useRef<CameraView>(null);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [microphonePermission, requestMicrophonePermission] = useMicrophonePermissions();
  const [isSaving, setIsSaving] = useState(false);

  const isRecording = useRecordingStore((s) => s.isRecording);
  const start = useRecordingStore((s) => s.start);
  const stop = useRecordingStore((s) => s.stop);

  if (!cameraPermission || !microphonePermission) {
    return <View style={styles.container} />;
  }

  if (!cameraPermission.granted || !microphonePermission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.message}>브이로그 컷을 촬영하려면 카메라와 마이크 접근 권한이 필요합니다.</Text>
        <Pressable
          style={styles.button}
          onPress={async () => {
            await requestCameraPermission();
            await requestMicrophonePermission();
          }}
        >
          <Text style={styles.buttonText}>권한 허용</Text>
        </Pressable>
      </View>
    );
  }

  async function handlePress() {
    if (!cameraRef.current) return;

    if (isRecording) {
      cameraRef.current.stopRecording();
      return;
    }

    start();
    try {
      const result = await cameraRef.current.recordAsync();
      const startedAt = useRecordingStore.getState().recordingStartedAt;
      stop();
      if (!result?.uri || !startedAt) return;

      const durationMs = Date.now() - startedAt;
      setIsSaving(true);
      await recordClip({ localUri: result.uri, durationMs });
      router.back();
    } catch (error) {
      // No error-reporting UI yet (out of scope for M1) — at minimum this must
      // not surface as a silent unhandled promise rejection.
      console.error('Recording failed', error);
    } finally {
      stop();
      setIsSaving(false);
    }
  }

  return (
    <View style={styles.container}>
      <CameraView ref={cameraRef} style={styles.camera} mode="video" />
      <View style={styles.controls}>
        <Pressable
          style={[styles.recordButton, isRecording && styles.recordButtonActive]}
          onPress={handlePress}
          disabled={isSaving}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'black', justifyContent: 'center', alignItems: 'center' },
  camera: { flex: 1, width: '100%' },
  controls: { position: 'absolute', bottom: 40 },
  recordButton: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#e53935' },
  recordButtonActive: { backgroundColor: '#8e0000' },
  message: { color: 'white', marginBottom: 16, textAlign: 'center', paddingHorizontal: 24 },
  button: { backgroundColor: '#333', padding: 12, borderRadius: 8 },
  buttonText: { color: 'white' },
});
