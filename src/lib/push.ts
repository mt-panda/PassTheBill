import Constants, { ExecutionEnvironment } from 'expo-constants';
import { router, type Href } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';

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
    await N.setNotificationChannelAsync('default', {
      name: 'New orders',
      importance: N.AndroidImportance.HIGH,
    });
  }
  const { granted } = await N.requestPermissionsAsync();
  if (!granted) return;
  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
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
