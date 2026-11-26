import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { registerPushToken } from './api';

// Show alerts as a banner even while the app is open.
Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
});

/**
 * Asks (once the user has a reason: they just set a price alert) for permission to send push
 * notifications, then registers this phone's token with the signed-in account. Quiet on failure:
 * email alerts keep working either way.
 */
export async function enablePushAlerts(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  try {
    const settings = await Notifications.getPermissionsAsync();
    let allowed = settings.granted;
    if (!allowed) {
      const res = await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowBadge: false, allowSound: true } });
      allowed = res.granted;
    }
    if (!allowed) return false;
    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) return false;
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    return await registerPushToken(data);
  } catch {
    return false;
  }
}
