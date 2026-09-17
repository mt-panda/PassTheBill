import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, Alert, View } from 'react-native';

import { styles } from '@/components/ui';
import { useSession } from '@/lib/session';
import { completeSignIn } from '@/lib/supabase';

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
      .then(reload)
      .finally(() => router.replace('/'));
  }, [code, error_description]);

  return (
    <View style={styles.center}>
      <ActivityIndicator />
    </View>
  );
}
