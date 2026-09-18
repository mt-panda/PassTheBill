import { Redirect, useLocalSearchParams, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, View } from 'react-native';

import { styles } from '@/components/ui';
import { useSession } from '@/lib/session';
import { completeSignIn, supabase } from '@/lib/supabase';

export default function AuthCallback() {
  const { code, error_description } = useLocalSearchParams<{ code?: string; error_description?: string }>();
  const { member, reload } = useSession();
  const [signedIn, setSignedIn] = useState<boolean>();

  useEffect(() => {
    const finish = async () => {
      if (error_description) throw new Error(error_description);
      if (code) await completeSignIn(code);
    };
    finish()
      .catch((e) => Alert.alert('Could not sign in', (e as Error).message))
      .then(async () => {
        await reload();
        const { data } = await supabase.auth.getSession();
        setSignedIn(!!data.session);
      })
      .catch(() => setSignedIn(false));
  }, [code, error_description]);

  if (signedIn !== undefined) return <Redirect href={(member ? '/' : signedIn ? '/join' : '/sign-in') as Href} />;

  return (
    <View style={styles.center}>
      <ActivityIndicator />
    </View>
  );
}
