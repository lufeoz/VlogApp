import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { recoverInterruptedWork } from '../services/recoveryService';

export default function RootLayout() {
  useEffect(() => {
    recoverInterruptedWork().catch((error) => console.error('Recovery failed', error));

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        recoverInterruptedWork().catch((error) => console.error('Recovery failed', error));
      }
    });
    return () => subscription.remove();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack />
    </GestureHandlerRootView>
  );
}
