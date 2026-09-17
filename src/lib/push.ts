import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { router, type Href } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';

// Show pushes as banners even while the app is open.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

async function register() {
  if (Platform.OS === 'android') {
    // Must exist before asking for permission on Android 13+. The server sends channelId "default".
    await Notifications.setNotificationChannelAsync('default', {
      name: 'New orders',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }
  const { granted } = await Notifications.requestPermissionsAsync();
  if (!granted) return;
  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
  const { error } = await supabase.rpc('register_push_token', { p_token: token });
  if (error) throw error;
}

/**
 * Once the user is in a team: registers this device for "new order" pushes, and opens the order when a
 * push is tapped (including one that cold-started the app).
 * ponytail: tokens aren't removed on sign-out, so a signed-out phone keeps getting its old team's pushes
 * until someone signs in on it. Add an unregister RPC before signOut() if that matters.
 */
export function usePushNotifications(memberId: string | undefined) {
  const response = Notifications.useLastNotificationResponse();
  const handled = useRef<string | null>(null);

  useEffect(() => {
    // Fails in Expo Go on Android (no push there) and on emulators; the app works fine without it.
    if (memberId) register().catch((e) => __DEV__ && console.log('Push registration skipped:', e.message));
  }, [memberId]);

  useEffect(() => {
    const id = response?.notification.request.identifier;
    const url = response?.notification.request.content.data?.url;
    // Wait for memberId: before that, the order screen is still behind Stack.Protected.
    if (!memberId || !id || handled.current === id || typeof url !== 'string') return;
    handled.current = id;
    router.push(url as Href);
  }, [response, memberId]);
}
