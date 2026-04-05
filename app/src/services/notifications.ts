import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import type { NavigationContainerRefWithCurrent } from '@react-navigation/native';
import type { RootStackParamList } from '../types';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

type NotificationData = Record<string, unknown>;

function getProjectId() {
  const fromExpoConfig =
    (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId;
  return fromExpoConfig || process.env.EXPO_PUBLIC_PROJECT_ID || undefined;
}

function navigateFromNotificationData(
  navigationRef: NavigationContainerRefWithCurrent<RootStackParamList>,
  data: NotificationData,
) {
  if (!navigationRef.isReady()) {
    return;
  }

  const screen = typeof data.screen === 'string' ? data.screen : '';
  const orderId = typeof data.orderId === 'string' ? data.orderId : undefined;
  const mainTarget = typeof data.tab === 'string' ? data.tab : undefined;

  if (screen === 'Orders') {
    navigationRef.navigate('Main', { screen: 'Orders' });
    return;
  }

  if (screen === 'Cart') {
    navigationRef.navigate('Main', { screen: 'Cart' });
    return;
  }

  if (screen === 'RateOrder' && orderId) {
    navigationRef.navigate('RateOrder', { orderId });
    return;
  }

  if (screen === 'Main' || screen === 'Menu') {
    navigationRef.navigate('Main', {
      screen: mainTarget === 'Orders' ? 'Orders' : 'Home',
    });
  }
}

export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) {
    console.log('Push notifications require a physical device');
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('Push notification permission denied');
    return null;
  }

  await Notifications.setNotificationChannelAsync('orders', {
    name: 'Order Updates',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#00C853',
    sound: 'default',
  });

  await Notifications.setNotificationChannelAsync('general', {
    name: 'General',
    importance: Notifications.AndroidImportance.DEFAULT,
    sound: 'default',
  });

  const projectId = getProjectId();
  const token = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
  return token.data;
}

export async function handleInitialNotification(
  navigationRef: NavigationContainerRefWithCurrent<RootStackParamList>,
) {
  const lastResponse = await Notifications.getLastNotificationResponseAsync();
  const data = lastResponse?.notification.request.content.data as NotificationData | undefined;

  if (data) {
    navigateFromNotificationData(navigationRef, data);
  }
}

export function setupNotificationListeners(
  navigationRef: NavigationContainerRefWithCurrent<RootStackParamList>,
) {
  const foregroundSub = Notifications.addNotificationReceivedListener((notification) => {
    console.log('Notification received:', notification.request.identifier);
  });

  const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data as NotificationData;
    navigateFromNotificationData(navigationRef, data);
  });

  return () => {
    foregroundSub.remove();
    responseSub.remove();
  };
}
