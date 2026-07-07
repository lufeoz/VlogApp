import { Alert, Platform } from 'react-native';

// react-native-web's Alert.alert is a no-op (`static alert() {}` — verified in
// node_modules/react-native-web/src/exports/Alert), so every error/success
// message in this app was silently vanishing on web. This falls back to
// window.alert there so the message is actually visible.
export function notify(title: string, message?: string): void {
  if (Platform.OS === 'web') {
    window.alert(message ? `${title}\n\n${message}` : title);
    return;
  }
  Alert.alert(title, message);
}
