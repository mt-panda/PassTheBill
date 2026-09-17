import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { Alert } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Member, Session } from '@/lib/session';
import { currentUserId, supabase } from '@/lib/supabase';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const scheme = useColorScheme();
  const theme = useTheme();
  const [member, setMember] = useState<Member | null>(null);

  async function reload() {
    try {
      const userId = await currentUserId();
      const { data, error } = await supabase
        .from('members')
        .select('id, name, team_id, teams(name, code)')
        .eq('id', userId)
        .maybeSingle();
      if (error) throw error;
      setMember(data as Member | null);
    } catch (e) {
      Alert.alert('Could not connect', (e as Error).message);
    }
  }

  useEffect(() => {
    reload().finally(() => SplashScreen.hideAsync());
  }, []);

  return (
    <Session value={{ member, reload }}>
      <ThemeProvider value={scheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack screenOptions={{ contentStyle: { backgroundColor: theme.background } }}>
          <Stack.Protected guard={!member}>
            <Stack.Screen name="join" options={{ title: 'Pass The Bill' }} />
          </Stack.Protected>
          <Stack.Protected guard={!!member}>
            <Stack.Screen name="index" />
            <Stack.Screen name="order/[id]" options={{ title: 'Order' }} />
            <Stack.Screen name="order-form" options={{ title: 'Order' }} />
            <Stack.Screen name="totals" options={{ title: 'Monthly totals' }} />
          </Stack.Protected>
        </Stack>
      </ThemeProvider>
    </Session>
  );
}
