import AsyncStorage from '@react-native-async-storage/async-storage';
import { NavigationBar } from 'expo-navigation-bar';
import { Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { Appearance, View } from 'react-native';

import { AnimatedSplash } from '@/components/splash';
import { ErrorState, SheetHost, ToastProvider } from '@/components/ui';
import { navigationTheme } from '@/constants/navigation-theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';
import { friendlyError, reportError, type FriendlyError } from '@/lib/errors';
import { usePushNotifications } from '@/lib/push';
import { Member, restoreThemePref, Session, ThemePref } from '@/lib/session';
import { supabase } from '@/lib/supabase';

export { RouteErrorBoundary as ErrorBoundary } from '@/components/ui';

SplashScreen.preventAutoHideAsync();

const ONBOARDED = 'onboarded';
const THEME = 'theme';
const applyTheme = (pref: ThemePref) => Appearance.setColorScheme?.(pref === 'system' ? 'unspecified' : pref);

export default function RootLayout() {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const theme = useTheme();
  const [userId, setUserId] = useState<string | null>(null);
  const [member, setMember] = useState<Member | null>(null);
  const memberRef = useRef<Member | null>(null);
  const [sessionError, setSessionError] = useState<FriendlyError | null>(null);
  const [onboarded, setOnboarded] = useState(false);
  const [ready, setReady] = useState(false);
  const [splash, setSplash] = useState(true);
  const [themePref, setThemePrefState] = useState<ThemePref>('light');

  usePushNotifications(member?.id);

  async function reload(): Promise<{ error?: FriendlyError }> {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      memberRef.current = null;
      setUserId(null);
      setMember(null);
      setSessionError(null);
      return {};
    }

    const { data, error } = await supabase
      .from('members')
      .select('id, name, team_id, teams(name, code)')
      .eq('id', session.user.id)
      .maybeSingle();

    if (error) {
      reportError('session.reload', error);
      const friendly = friendlyError(error);
      // Block the app only when nobody is loaded yet; mid-session failures go back to the caller.
      if (!memberRef.current) setSessionError(friendly);
      return { error: friendly };
    }
    // userId and member land in the same render, so a signed-in user never flashes through /join.
    memberRef.current = data as Member | null;
    setUserId(session.user.id);
    setSessionError(null);
    setMember(data as Member | null);
    return {};
  }

  useEffect(() => {
    Promise.all([
      reload(),
      AsyncStorage.getItem(ONBOARDED)
        .then((v) => setOnboarded(v === '1'))
        .catch(() => {}),
      AsyncStorage.getItem(THEME)
        .then((v) => {
          const pref = restoreThemePref(v);
          setThemePrefState(pref);
          applyTheme(pref);
        })
        .catch(() => applyTheme('light')),
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

  const blocked = ready && !!sessionError && !member;

  return (
    <Session value={{ member, reload, finishOnboarding, themePref, setThemePref }}>
      <ThemeProvider value={navigationTheme(scheme, theme)}>
        <View style={{ flex: 1, backgroundColor: theme.background }}>
          <StatusBar style="auto" />
          <NavigationBar style="auto" />

          <SheetHost>
            <ToastProvider>
              {blocked ? (
                <View style={{ flex: 1, justifyContent: 'center', padding: 24 }}>
                  <ErrorState
                    title="Can't reach PassTheBill"
                    message={sessionError.message}
                    onRetry={() => void reload()}
                    secondary={{ label: 'Sign out', onPress: () => void supabase.auth.signOut() }}
                  />
                </View>
              ) : (
                <Stack
                  screenOptions={{
                    contentStyle: { backgroundColor: theme.background },
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
                    <Stack.Screen name="order-confirmed" options={{ headerShown: false, animation: 'fade', gestureEnabled: false }} />
                  </Stack.Protected>

                  <Stack.Screen name="auth-callback" options={{ headerShown: false, animation: 'fade' }} />
                </Stack>
              )}
            </ToastProvider>
          </SheetHost>

          {splash && <AnimatedSplash ready={ready} onDone={() => setSplash(false)} />}
        </View>
      </ThemeProvider>
    </Session>
  );
}
