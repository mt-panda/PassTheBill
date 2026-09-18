import { Alert, Platform, ScrollView, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Avatar, Button, Card, Row, Segmented, styles } from '@/components/ui';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';

export default function SettingsScreen() {
  const { member, themePref, setThemePref } = useSession();
  const me = member!;

  const signOut = () =>
    Alert.alert('Sign out?', 'You can sign back in with Google any time.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => supabase.auth.signOut() },
    ]);

  return (
    <ScrollView contentContainerStyle={styles.screen} contentInsetAdjustmentBehavior="automatic">
      <Card>
        <Row style={{ justifyContent: 'flex-start' }}>
          <Avatar name={me.name} size={56} />
          <View style={{ flexShrink: 1, gap: 2 }}>
            <ThemedText type="smallBold" style={{ fontSize: 18 }} numberOfLines={1}>
              {me.name}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
              {me.teams.name} · code {me.teams.code}
            </ThemedText>
          </View>
        </Row>
      </Card>

      {Platform.OS !== 'web' && (
        <>
          <ThemedText type="label" themeColor="textSecondary" style={styles.section}>
            Appearance
          </ThemedText>
          <Card>
            <Segmented
              value={themePref}
              onChange={setThemePref}
              options={[
                { value: 'system', label: 'Auto', icon: 'phone' },
                { value: 'light', label: 'Light', icon: 'sun' },
                { value: 'dark', label: 'Dark', icon: 'moon' },
              ]}
            />
            <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 13 }}>
              {themePref === 'system'
                ? 'Auto matches your phone: light by day, dark when your phone is in dark mode.'
                : `The app always uses the ${themePref} theme, whatever your phone is set to.`}
            </ThemedText>
          </Card>
        </>
      )}

      <ThemedText type="label" themeColor="textSecondary" style={styles.section}>
        Account
      </ThemedText>
      <Button title="Sign out" icon="signOut" variant="danger" onPress={signOut} />
    </ScrollView>
  );
}
