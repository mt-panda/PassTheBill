import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, Alert, View } from 'react-native';

import { styles } from '@/components/ui';
import { useSession } from '@/lib/session';
import { completeSignIn } from '@/lib/supabase';

// Google sends the user back to …/auth-callback?code=…. On Android the OS routes that link here instead of
// (or as well as) resolving the browser sheet, so this screen finishes sign-in itself.
// It sits outside every Stack.Protected group, so it must navigate away on its own once done.
export default function AuthCallback() {
  const { code, error_description } = useLocalSearchParams<{ code?: string; error_description?: string }>();
  const { reload } = useSession();

  useEffect(() => {
    const finish = async () => {
      if (error_description) throw new Error(error_description);
      if (code) await completeSignIn(code);
    };
    finish()
      .catch((e) => Alert.alert('Could not sign in', (e as Error).message))
      .then(reload) // guards need userId/member before we leave, or "/" bounces straight back to sign-in
      .finally(() => router.replace('/'));
  }, [code, error_description]);

  return (
    <View style={styles.center}>
      <ActivityIndicator />
    </View>
  );
}
