import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import { useFocusEffect } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffectEvent } from 'react';

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

export async function signInWithGoogle() {
  const redirectTo = Linking.createURL('auth-callback');
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

export function useLive(tables: string, load: () => void, key = '') {
  const onChange = useEffectEvent(load);

  useFocusEffect(
    useCallback(() => {
      onChange();
      const channel = supabase.channel(`live:${tables}:${Math.random()}`);
      for (const table of tables.split(',')) {
        channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => onChange());
      }
      channel.subscribe();
      return () => {
        supabase.removeChannel(channel);
      };
    }, [tables, key])
  );
}
