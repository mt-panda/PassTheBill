import { Redirect, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ErrorState } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { friendlyError, reportError } from '@/lib/errors';
import { useSession } from '@/lib/session';
import { completeSignIn, supabase } from '@/lib/supabase';

export { RouteErrorBoundary as ErrorBoundary } from '@/components/ui';

export default function AuthCallback() {
  const { code, error_description } = useLocalSearchParams<{ code?: string; error_description?: string }>();
  const { member, reload } = useSession();
  const router = useRouter();
  const theme = useTheme();
  const [signedIn, setSignedIn] = useState<boolean>();
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    const finish = async () => {
      if (error_description) throw new Error(error_description);
      if (code) await completeSignIn(code);
    };
    finish()
      .catch((e) => {
        reportError('auth-callback', e);
        setFailed(friendlyError(e).message);
      })
      .then(async () => {
        await reload();
        const { data } = await supabase.auth.getSession();
        setSignedIn(!!data.session);
      })
      .catch(() => setSignedIn(false));
  }, [code, error_description]);

  if (failed && signedIn === false) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', padding: Spacing.xl, backgroundColor: theme.background }}>
        <ErrorState title="Sign-in didn’t finish" message={failed} onRetry={() => router.replace('/sign-in')} />
      </View>
    );
  }
  if (signedIn !== undefined) return <Redirect href={(member ? '/' : signedIn ? '/join' : '/sign-in') as Href} />;

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md, backgroundColor: theme.background }}>
      <ActivityIndicator color={theme.primary} />
      <ThemedText type="body" themeColor="textSecondary">
        Signing you in…
      </ThemedText>
    </View>
  );
}
