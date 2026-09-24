import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import { AppState, Platform } from 'react-native';
import { useFocusEffect } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useRef, useState } from 'react';

import { coalesce, createLoadGate } from '@/lib/live';

// Required by expo-web-browser for OAuth completion on web.
WebBrowser.maybeCompleteAuthSession();

export const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_KEY!,
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      flowType: 'pkce',
    },
  }
);

// Supabase's React Native guidance: only refresh the session while the app is in the foreground.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}

function getAuthRedirectUrl() {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return `${window.location.origin}/auth-callback`;
  }

  return Linking.createURL('auth-callback');
}

export async function signInWithGoogle() {
  const redirectTo = getAuthRedirectUrl();
  if (__DEV__) console.log('Google sign-in redirect URL:', redirectTo);
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, skipBrowserRedirect: true, queryParams: { prompt: 'select_account' } },
  });
  if (error) throw error;

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success') return;

  const { queryParams } = Linking.parse(result.url);
  if (queryParams?.error_description) throw new Error(String(queryParams.error_description));
  if (!queryParams?.code) throw new Error('Google sign-in did not return a code. Check the redirect URLs in Supabase.');
  await completeSignIn(String(queryParams.code));
}

const exchanges = new Map<string, Promise<void>>();

export function completeSignIn(code: string) {
  if (!exchanges.has(code)) {
    exchanges.set(
      code,
      supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
        if (error) throw error;
      })
    );
  }
  return exchanges.get(code)!;
}

/**
 * Loads on focus, subscribes to realtime changes while focused, and reloads when the app returns
 * to the foreground. Bursts of events are coalesced (250 ms); `isLatest()` lets the loader drop
 * responses that a newer load has superseded.
 */
export function useLive(tables: string, load: (isLatest: () => boolean) => void | Promise<void>, key = '') {
  const [gate] = useState(createLoadGate);
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  });

  useFocusEffect(
    useCallback(() => {
      const run = () => void loadRef.current(gate.begin());
      run();
      const trigger = coalesce(() => run(), 250);
      const channel = supabase.channel(`live:${tables}:${key}:${Math.random()}`);
      for (const table of tables.split(',')) {
        channel.on('postgres_changes', { event: '*', schema: 'public', table: table.trim() }, () => trigger());
      }
      channel.subscribe();
      const appState = AppState.addEventListener('change', (state) => {
        if (state === 'active') run();
      });
      return () => {
        trigger.cancel();
        appState.remove();
        supabase.removeChannel(channel);
      };
    }, [tables, key, gate])
  );
}
