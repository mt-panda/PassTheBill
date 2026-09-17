import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { useFocusEffect } from 'expo-router';
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
    },
  }
);

/** Existing session's user id, or signs in anonymously. */
export async function currentUserId() {
  const { data } = await supabase.auth.getSession();
  if (data.session) return data.session.user.id;
  const { data: anon, error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
  return anon.user!.id;
}

/** Runs `load` on focus, whenever any of `tables` changes, and whenever `key` changes. */
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
