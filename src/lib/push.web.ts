import type { NotificationStatus } from './push';

export function usePushNotifications(_memberId: string | undefined) {}

const unavailable: NotificationStatus = { state: 'unavailable', canAskAgain: false };
export const getNotificationStatus = async () => unavailable;
export const enableNotifications = async () => unavailable;
export const registerIfGranted = async () => {};
export const openNotificationSettings = async () => {};
export const unregisterPushToken = async () => {};
