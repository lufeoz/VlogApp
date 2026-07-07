import { Platform } from 'react-native';

// The camera -> native composition -> Photo Library pipeline, and everything
// that depends on expo-file-system's File/Directory API for upload/download,
// has no web implementation: expo-camera's recordAsync, expo-media-library,
// and modules/video-composer are all native-only (verified against official
// Expo docs, not assumed). This gives one consistent, user-facing message at
// every entry point that depends on one of those, instead of letting a
// missing native method fail with an obscure runtime error.
export function assertNativeFeatureAvailable(featureName: string): void {
  if (Platform.OS === 'web') {
    throw new Error(`${featureName}은(는) 웹에서 지원되지 않습니다. 모바일 앱에서 이용해주세요.`);
  }
}
