import Constants, { ExecutionEnvironment } from 'expo-constants';
import { router, type Href } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';

const NOTIFICATION_CHANNEL_ID = 'pass-the-bill';
const NOTIFICATION_SOUND = 'ptb_notification.wav';

type NotificationsModule = typeof import('expo-notifications');
type NotificationResponse = import('expo-notifications').NotificationResponse;
const Notifications: NotificationsModule | null =
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient ? null : require('expo-notifications');

Notifications?.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

async function register(N: NotificationsModule) {
  if (Platform.OS === 'android') {
    await N.setNotificationChannelAsync(NOTIFICATION_CHANNEL_ID, {
      name: 'PassTheBill',
      description: 'PassTheBill alerts for orders and extra charges',
      importance: N.AndroidImportance.HIGH,
      sound: NOTIFICATION_SOUND,
      vibrationPattern: [0, 250, 120, 250],
    });
  }

  const { status: existingStatus } = await N.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await N.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: true, allowSound: true },
    });
    finalStatus = status;
  }
  if (finalStatus !== 'granted') {
    if (__DEV__) console.log('Notification permission not granted:', finalStatus);
    return;
  }

  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) throw new Error('Expo project ID is missing');
  const { data: token } = await N.getExpoPushTokenAsync({ projectId });
  const { error } = await supabase.rpc('register_push_token', { p_token: token });
  if (error) throw error;
}

export function usePushNotifications(memberId: string | undefined) {
  const handled = useRef<string | null>(null);

  useEffect(() => {
    if (!Notifications || !memberId) return;
    register(Notifications).catch((e) => __DEV__ && console.log('Push registration skipped:', e.message));
    const open = (response: NotificationResponse | null) => {
      const id = response?.notification.request.identifier;
      const url = response?.notification.request.content.data?.url;
      if (!id || handled.current === id || typeof url !== 'string') return;
      handled.current = id;
      router.push(url as Href);
    };
    open(Notifications.getLastNotificationResponse());
    const subscription = Notifications.addNotificationResponseReceivedListener(open);
    return () => subscription.remove();
  }, [memberId]);
}
