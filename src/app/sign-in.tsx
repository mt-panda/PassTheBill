import { useState } from 'react';
import { Alert, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { LogoMark } from '@/components/splash';
import { ThemedText } from '@/components/themed-text';
import { Button, IconButton, Screen } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { friendlyError, reportError } from '@/lib/errors';
import { signInWithGoogle, supabase } from '@/lib/supabase';

export { RouteErrorBoundary as ErrorBoundary } from '@/components/ui';

const devAccounts = (__DEV__ ? (process.env.EXPO_PUBLIC_DEV_LOGINS ?? '') : '')
  .split(',')
  .map((entry) => {
    const i = entry.indexOf(':');
    return { email: entry.slice(0, i).trim(), password: entry.slice(i + 1).trim() };
  })
  .filter((a) => a.email && a.password);

function GoogleMark() {
  return (
    <View
      style={{
        width: 22,
        height: 22,
        borderRadius: "50%",
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <Svg width={16} height={16} viewBox="0 0 24 24">
        <Path
          fill="#4285F4"
          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        />
        <Path
          fill="#34A853"
          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        />
        <Path
          fill="#FBBC05"
          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        />
        <Path
          fill="#EA4335"
          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        />
      </Svg>
    </View>
  );
}

export default function SignInScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signIn() {
    setBusy(true);
    setError(null);
    try {
      await signInWithGoogle();
    } catch (e) {
      reportError('sign-in', e);
      setError(friendlyError(e).message);
    } finally {
      setBusy(false);
    }
  }

  async function devSignIn(account: { email: string; password: string }) {
    setBusy(true);
    const { error: e } = await supabase.auth.signInWithPassword(account);
    if (e) Alert.alert('Dev login failed', e.message);
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
    <Screen scroll={false} contentStyle={{ justifyContent: 'center', maxWidth: 520 }}>
      <View style={{ gap: Spacing.md }}>
        <LogoMark tile={theme.primary} ink={theme.onPrimary} />
        <ThemedText type="screenTitle" style={{ fontSize: 34, lineHeight: 40 }}>
          PassTheBill
        </ThemedText>
        <ThemedText type="body" themeColor="textSecondary">
          Lunch made simple.
        </ThemedText>
      </View>
      <View style={{ gap: Spacing.sm, marginTop: Spacing.xxl }}>
        <Button title="Continue with Google" left={<GoogleMark />} loading={busy} onPress={signIn} />
        {error && (
          <ThemedText type="small" themeColor="danger" style={{ textAlign: 'center' }} accessibilityLiveRegion="polite">
            {error}
          </ThemedText>
        )}
        <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center' }}>
          New here? This creates your account.
        </ThemedText>
      </View>
      {devAccounts.length > 0 && (
        <View style={{ position: 'absolute', top: insets.top + 12, right: 16 }}>
          <IconButton icon="dev" label="Developer login" disabled={busy} onPress={pickDevAccount} />
        </View>
      )}
    </Screen>
  );
}
