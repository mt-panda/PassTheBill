import { requireOptionalNativeModule } from 'expo';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { router, type Href } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Linking, Platform } from 'react-native';

import { supabase } from '@/lib/supabase';

const NOTIFICATION_CHANNEL_ID = 'pass-the-bill';
const NOTIFICATION_SOUND = 'ptb_notification.wav';
// Android fixes a channel's sound when it is first created, and every install before android.versionCode 2
// created 'pass-the-bill' without the sound bundled. Builds that bundle it (app.json expo-notifications
// "sounds") use a new channel and register their token for it (supabase/notification-channel-v2.sql).
const SOUND_CHANNEL_ID = 'pass-the-bill-v2';
const FIRST_BUILD_WITH_SOUND = 2;
// android.versionCode, read from expo-application's native module (autolinked via expo-notifications).
const nativeBuild = Number(requireOptionalNativeModule<{ nativeBuildVersion?: string }>('ExpoApplication')?.nativeBuildVersion);
const hasBundledSound = Platform.OS === 'android' && nativeBuild >= FIRST_BUILD_WITH_SOUND;

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
    const channel = {
      name: 'PassTheBill',
      description: 'PassTheBill alerts for orders and extra charges',
      importance: N.AndroidImportance.HIGH,
      sound: NOTIFICATION_SOUND,
      vibrationPattern: [0, 250, 120, 250],
    };
    // Kept on every build: tokens registered before notification-channel-v2.sql still target it.
    await N.setNotificationChannelAsync(NOTIFICATION_CHANNEL_ID, channel);
    if (hasBundledSound) await N.setNotificationChannelAsync(SOUND_CHANNEL_ID, { ...channel, name: 'PassTheBill alerts' });
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
  if (hasBundledSound) {
    const { error } = await supabase.rpc('register_push_token', { p_token: token, p_channel: SOUND_CHANNEL_ID });
    if (!error) return;
    // notification-channel-v2.sql not applied yet: fall back to the legacy channel.
  }
  const { error } = await supabase.rpc('register_push_token', { p_token: token });
  if (error) throw error;
}

export type NotificationStatus = { state: 'on' | 'off' | 'unavailable'; canAskAgain: boolean };

export async function getNotificationStatus(): Promise<NotificationStatus> {
  if (!Notifications) return { state: 'unavailable', canAskAgain: false };
  const { status, canAskAgain } = await Notifications.getPermissionsAsync();
  return { state: status === 'granted' ? 'on' : 'off', canAskAgain };
}

/** Asks for permission (if Android still allows asking) and registers the token right away. */
export async function enableNotifications(): Promise<NotificationStatus> {
  if (!Notifications) return { state: 'unavailable', canAskAgain: false };
  const current = await getNotificationStatus();
  if (current.state === 'on' || !current.canAskAgain) return current;
  await Notifications.requestPermissionsAsync();
  await registerIfGranted();
  return getNotificationStatus();
}

/** Registers this device's token when permission is granted (e.g. just enabled in system settings). */
export async function registerIfGranted() {
  if (!Notifications) return;
  if ((await getNotificationStatus()).state === 'on') await register(Notifications).catch(() => {});
}

export async function openNotificationSettings() {
  const pkg = Constants.expoConfig?.android?.package ?? 'com.tahirrafiqg.passthebill';
  try {
    await Linking.sendIntent('android.settings.APP_NOTIFICATION_SETTINGS', [
      { key: 'android.provider.extra.APP_PACKAGE', value: pkg },
    ]);
  } catch {
    await Linking.openSettings();
  }
}

/** Best effort: stop pushes to this device for the user who is signing out. */
export async function unregisterPushToken() {
  try {
    if (!Notifications || (await getNotificationStatus()).state !== 'on') return;
    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) return;
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    await supabase.rpc('unregister_push_token', { p_token: token });
  } catch (e) {
    if (__DEV__) console.log('Push unregister skipped:', (e as Error).message);
  }
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
