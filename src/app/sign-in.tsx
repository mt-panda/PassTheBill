import { useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LogoMark } from '@/components/splash';
import { ThemedText } from '@/components/themed-text';
import { Button, IconButton, styles } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { signInWithGoogle, supabase } from '@/lib/supabase';

const devAccounts = (__DEV__ ? (process.env.EXPO_PUBLIC_DEV_LOGINS ?? '') : '')
  .split(',')
  .map((entry) => {
    const i = entry.indexOf(':');
    return { email: entry.slice(0, i).trim(), password: entry.slice(i + 1).trim() };
  })
  .filter((a) => a.email && a.password);

function GoogleMark() {
  const size = 20;
  const stroke = 2.4;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: stroke,
        borderTopColor: '#EA4335',
        borderRightColor: '#4285F4',
        borderBottomColor: '#34A853',
        borderLeftColor: '#FBBC05',
        backgroundColor: '#FFFFFF',
        overflow: 'hidden',
      }}>
      <View
        style={{
          position: 'absolute',
          top: size / 2 - stroke / 2 - stroke,
          right: -stroke,
          width: size / 2 + stroke,
          height: stroke,
          backgroundColor: '#4285F4',
        }}
      />
    </View>
  );
}

export default function SignInScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);

  async function signIn() {
    setBusy(true);
    try {
      await signInWithGoogle();
    } catch (e) {
      Alert.alert('Could not sign in', (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function devSignIn(account: { email: string; password: string }) {
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword(account);
    if (error) Alert.alert('Dev login failed', error.message);
    setBusy(false);
  }

  function pickDevAccount() {
    if (devAccounts.length === 1) return devSignIn(devAccounts[0]);
    Alert.alert('Sign in as', undefined, [
      ...devAccounts.slice(0, 3).map((a) => ({ text: a.email, onPress: () => devSignIn(a) })),
      { text: 'Cancel', style: 'cancel' as const },
    ]);
  }

  return (
    <>
      <ScrollView contentContainerStyle={[styles.screen, { paddingTop: insets.top + 32, maxWidth: 520 }]}>
        <View style={{ gap: 12, marginBottom: 12 }}>
          <LogoMark tile={theme.primary} ink={theme.onPrimary} />
          <ThemedText type="subtitle" style={{ fontSize: 32, lineHeight: 38 }}>
            PassTheBill
          </ThemedText>
          <ThemedText themeColor="textSecondary">
            Split team lunch orders in seconds. Everyone taps what they ate, and the app works out who owes what.
          </ThemedText>
        </View>

        <Button title={busy ? 'Opening Google…' : 'Continue with Google'} left={<GoogleMark />} disabled={busy} onPress={signIn} />
        <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center' }}>
          No password needed. New here? This creates your account.
        </ThemedText>
      </ScrollView>
      {devAccounts.length > 0 && (
        <View style={{ position: 'absolute', top: insets.top + 12, right: 16 }}>
          <IconButton icon="dev" label="Developer login" disabled={busy} onPress={pickDevAccount} />
        </View>
      )}
    </>
  );
}
