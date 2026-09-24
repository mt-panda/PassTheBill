import Constants from 'expo-constants';
import { useFocusEffect, useRouter } from 'expo-router';
import * as Updates from 'expo-updates';
import { useCallback, useEffect, useState } from 'react';
import { AppState, Platform, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Avatar, BottomSheet, Button, Card, Divider, Icon, Input, ListRow, Row, Screen, SectionHeader, Segmented, useToast } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { friendlyError, reportError } from '@/lib/errors';
import {
  enableNotifications,
  getNotificationStatus,
  openNotificationSettings,
  registerIfGranted,
  unregisterPushToken,
  type NotificationStatus,
} from '@/lib/push';
import { useSession, type ThemePref } from '@/lib/session';
import { supabase } from '@/lib/supabase';

export { RouteErrorBoundary as ErrorBoundary } from '@/components/ui';

type Sheet = null | 'profile' | 'appearance' | 'feedback' | 'signout';
type FeedbackType = 'bug' | 'suggestion';

const THEME_LABEL: Record<ThemePref, string> = { light: 'Light', dark: 'Dark', system: 'System' };

function versionLine() {
  const update = !Updates.isEnabled ? 'dev' : Updates.isEmbeddedLaunch ? 'built-in' : (Updates.updateId ?? '').slice(0, 8);
  return `PassTheBill ${Constants.expoConfig?.version ?? ''} · ${update}`;
}

export default function SettingsScreen() {
  const router = useRouter();
  const toast = useToast();
  const { member, themePref, setThemePref, reload } = useSession();
  const me = member!;
  const [email, setEmail] = useState<string | null>(null);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [busy, setBusy] = useState(false);
  const [sheetError, setSheetError] = useState<string | null>(null);
  const [name, setName] = useState(me.name);
  const [feedbackType, setFeedbackType] = useState<FeedbackType>('bug');
  const [feedback, setFeedback] = useState('');
  const [notif, setNotif] = useState<NotificationStatus | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);

  // Permission can change in system settings: refresh on focus and when the app comes back.
  const refreshNotif = useCallback(async () => {
    const next = await getNotificationStatus();
    setNotif((prev) => {
      if (prev?.state === 'off' && next.state === 'on') void registerIfGranted();
      return next;
    });
  }, []);
  useFocusEffect(
    useCallback(() => {
      void refreshNotif();
      const sub = AppState.addEventListener('change', (s) => s === 'active' && void refreshNotif());
      return () => sub.remove();
    }, [refreshNotif])
  );

  const open = (s: Sheet) => {
    setSheetError(null);
    setSheet(s);
  };
  const close = () => setSheet(null);

  async function saveName() {
    const next = name.trim();
    if (!next) return setSheetError('Please enter your name.');
    if (next.length > 60) return setSheetError('Please keep your name under 60 characters.');
    setBusy(true);
    const { error } = await supabase.from('members').update({ name: next }).eq('id', me.id);
    if (error) {
      setBusy(false);
      reportError('settings.name', error);
      return setSheetError(friendlyError(error).message);
    }
    const r = await reload();
    setBusy(false);
    if (r.error) return setSheetError(r.error.message);
    close();
    toast.show('Profile updated');
  }

  async function sendFeedback() {
    const message = feedback.trim();
    if (!message) return setSheetError('Tell us what happened or what you’d like to see.');
    if (message.length > 2000) return setSheetError('Please keep it under 2000 characters.');
    setBusy(true);
    const { error } = await supabase
      .from('feedback')
      .insert({ user_id: me.id, team_id: me.team_id, type: feedbackType, message, platform: Platform.OS });
    setBusy(false);
    if (error) {
      reportError('settings.feedback', error);
      return setSheetError(friendlyError(error).message);
    }
    setFeedback('');
    close();
    toast.show('Feedback sent');
  }

  async function signOut() {
    setBusy(true);
    await unregisterPushToken();
    await supabase.auth.signOut();
    setBusy(false);
  }

  async function onNotifications() {
    if (!notif || notif.state === 'unavailable') return;
    if (notif.state === 'off' && notif.canAskAgain) return setNotif(await enableNotifications());
    await openNotificationSettings();
  }

  const notifLabel = !notif ? '…' : notif.state === 'on' ? 'On' : notif.state === 'off' ? 'Off' : 'Not available';

  return (
    <Screen>
      <ThemedText type="screenTitle">Settings</ThemedText>

      <SectionHeader title="Your account" />
      <Card>
        <Row style={{ justifyContent: 'flex-start' }}>
          <Avatar name={me.name} size={48} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <ThemedText type="bodyStrong" numberOfLines={1}>
              {me.name}
            </ThemedText>
            {email ? (
              <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                {email}
              </ThemedText>
            ) : null}
          </View>
        </Row>
        <Button
          title="Edit profile"
          icon="edit"
          variant="secondary"
          onPress={() => {
            setName(me.name);
            open('profile');
          }}
        />
      </Card>

      <SectionHeader title="Preferences" />
      <Card style={{ gap: 0, paddingVertical: Spacing.xs }}>
        {Platform.OS !== 'web' && (
          <>
            <ListRow leading={<Icon name="sun" color="textSecondary" />} title="Appearance" value={THEME_LABEL[themePref]} chevron onPress={() => open('appearance')} />
            <Divider />
          </>
        )}
        <ListRow leading={<Icon name="bell" color="textSecondary" />} title="Notifications" value={notifLabel} chevron onPress={onNotifications} />
      </Card>

      <SectionHeader title="Team" />
      <Card style={{ gap: 0, paddingVertical: Spacing.xs }}>
        <ListRow leading={<Icon name="team" color="textSecondary" />} title={me.teams.name} chevron onPress={() => router.navigate('/team')} />
      </Card>

      <SectionHeader title="Help & feedback" />
      <Card style={{ gap: 0, paddingVertical: Spacing.xs }}>
        <ListRow
          leading={<Icon name="info" color="textSecondary" />}
          title="Send feedback"
          chevron
          onPress={() => {
            setFeedbackType('bug');
            open('feedback');
          }}
        />
      </Card>

      <Button title="Sign out" icon="signOut" variant="danger" onPress={() => open('signout')} />
      <ThemedText type="caption" themeColor="textSecondary" style={{ textAlign: 'center' }}>
        {versionLine()}
      </ThemedText>

      <BottomSheet
        visible={sheet === 'profile'}
        onClose={close}
        title="Edit profile"
        dismissible={!busy}
        confirmDiscard={name.trim() !== me.name}
        error={sheetError}
        footer={<Button title="Save" loading={busy} onPress={saveName} />}>
        <Input label="Name" value={name} onChangeText={(v) => { setName(v); setSheetError(null); }} autoFocus maxLength={60} returnKeyType="done" onSubmitEditing={saveName} />
      </BottomSheet>

      <BottomSheet visible={sheet === 'appearance'} onClose={close} title="Appearance">
        {(['light', 'dark', 'system'] as ThemePref[]).map((p) => (
          <ListRow
            key={p}
            title={THEME_LABEL[p]}
            subtitle={p === 'system' ? 'Matches your phone' : undefined}
            trailing={themePref === p ? <Icon name="check" color="primaryText" /> : undefined}
            onPress={() => {
              setThemePref(p);
              close();
            }}
          />
        ))}
      </BottomSheet>

      <BottomSheet
        visible={sheet === 'feedback'}
        onClose={close}
        title="Send feedback"
        dismissible={!busy}
        confirmDiscard={feedback.trim().length > 0}
        error={sheetError}
        footer={<Button title="Send" loading={busy} onPress={sendFeedback} />}>
        <Segmented
          value={feedbackType}
          onChange={setFeedbackType}
          options={[
            { value: 'bug', label: 'Bug' },
            { value: 'suggestion', label: 'Suggestion' },
          ]}
        />
        <Input
          label={feedbackType === 'bug' ? 'What went wrong?' : 'What would you like to see?'}
          value={feedback}
          onChangeText={(v) => { setFeedback(v); setSheetError(null); }}
          multiline
          numberOfLines={5}
          maxLength={2000}
          inputStyle={{ minHeight: 120, textAlignVertical: 'top' }}
          hint={`${feedback.length}/2000`}
        />
      </BottomSheet>

      <BottomSheet
        visible={sheet === 'signout'}
        onClose={close}
        title="Sign out?"
        dismissible={!busy}
        footer={
          <>
            <Button title="Sign out" variant="danger" loading={busy} onPress={signOut} />
            <Button title="Cancel" variant="ghost" onPress={close} />
          </>
        }>
        <ThemedText type="body">You can sign back in with Google any time.</ThemedText>
      </BottomSheet>
    </Screen>
  );
}
