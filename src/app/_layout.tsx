import AsyncStorage from '@react-native-async-storage/async-storage';
import { NavigationBar } from 'expo-navigation-bar';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Alert, Appearance, KeyboardAvoidingView, Platform, View } from 'react-native';

import { AnimatedBackground } from '@/components/animated-background';
import { AnimatedSplash } from '@/components/splash';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';
import { usePushNotifications } from '@/lib/push';
import { Member, Session, ThemePref } from '@/lib/session';
import { supabase } from '@/lib/supabase';

SplashScreen.preventAutoHideAsync();

const ONBOARDED = 'onboarded';
const THEME = 'theme';
const applyTheme = (pref: ThemePref) => Appearance.setColorScheme?.(pref === 'system' ? 'unspecified' : pref);

export default function RootLayout() {
  const scheme = useColorScheme();
  const theme = useTheme();
  const [userId, setUserId] = useState<string | null>(null);
  const [member, setMember] = useState<Member | null>(null);
  const [onboarded, setOnboarded] = useState(false);
  const [ready, setReady] = useState(false);
  const [splash, setSplash] = useState(true);
  const [themePref, setThemePrefState] = useState<ThemePref>('system');

  usePushNotifications(member?.id);

  async function reload() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    setUserId(session?.user.id ?? null);
    if (!session) return setMember(null);

    const { data, error } = await supabase
      .from('members')
      .select('id, name, team_id, teams(name, code)')
      .eq('id', session.user.id)
      .maybeSingle();

    if (error) return Alert.alert('Could not connect', error.message);
    setMember(data as Member | null);
  }

  useEffect(() => {
    Promise.all([
      reload(),
      AsyncStorage.getItem(ONBOARDED)
        .then((v) => setOnboarded(v === '1'))
        .catch(() => {}),
      AsyncStorage.getItem(THEME)
        .then((v) => {
          if (v === 'light' || v === 'dark') {
            setThemePrefState(v);
            applyTheme(v);
          }
        })
        .catch(() => {}),
    ]).finally(() => {
      setReady(true);
      SplashScreen.hideAsync();
    });

    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') setTimeout(reload, 0);
    });

    return () => data.subscription.unsubscribe();
  }, []);

  function finishOnboarding() {
    setOnboarded(true);
    AsyncStorage.setItem(ONBOARDED, '1').catch(() => {});
  }

  function setThemePref(pref: ThemePref) {
    setThemePrefState(pref);
    applyTheme(pref);
    AsyncStorage.setItem(THEME, pref).catch(() => {});
  }

  return (
    <Session value={{ member, reload, finishOnboarding, themePref, setThemePref }}>
      <ThemeProvider value={scheme === 'dark' ? DarkTheme : DefaultTheme}>
        <View style={{ flex: 1, backgroundColor: theme.background }}>
          <AnimatedBackground />

          <StatusBar style="auto" />
          <NavigationBar style="auto" />

          <KeyboardAvoidingView
            style={{ flex: 1 }}
            enabled={Platform.OS !== 'web'}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            <Stack
              screenOptions={{
                contentStyle: { backgroundColor: 'transparent' },
                headerStyle: { backgroundColor: theme.background },
                headerShadowVisible: false,
                headerTintColor: theme.text,
                headerTitleStyle: { fontWeight: '600' },
                headerBackButtonDisplayMode: 'minimal',
                animation: 'ios_from_right',
              }}>
              <Stack.Protected guard={!userId && !onboarded}>
                <Stack.Screen name="onboarding" options={{ headerShown: false, animation: 'fade' }} />
              </Stack.Protected>

              <Stack.Protected guard={!userId && onboarded}>
                <Stack.Screen name="sign-in" options={{ headerShown: false, animation: 'fade' }} />
              </Stack.Protected>

              <Stack.Protected guard={!!userId && !member}>
                <Stack.Screen name="join" options={{ headerShown: false, animation: 'fade' }} />
              </Stack.Protected>

              <Stack.Protected guard={!!member}>
                <Stack.Screen name="(tabs)" options={{ headerShown: false, animation: 'fade' }} />
                <Stack.Screen name="order/[id]" options={{ title: 'Order' }} />
                <Stack.Screen name="order-form" options={{ title: 'Order', animation: 'slide_from_bottom' }} />
              </Stack.Protected>

              <Stack.Screen name="auth-callback" options={{ headerShown: false, animation: 'fade' }} />
            </Stack>
          </KeyboardAvoidingView>

          {splash && <AnimatedSplash ready={ready} onDone={() => setSplash(false)} />}
        </View>
      </ThemeProvider>
    </Session>
  );
}
