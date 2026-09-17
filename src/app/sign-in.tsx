import { useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LogoMark } from '@/components/splash';
import { ThemedText } from '@/components/themed-text';
import { Button, styles } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { signInWithGoogle } from '@/lib/supabase';

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

  return (
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

      <Button title={busy ? 'Opening Google…' : 'Continue with Google'} disabled={busy} onPress={signIn} />
      <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center' }}>
        No password needed. New here? This creates your account.
      </ThemedText>
    </ScrollView>
  );
}
