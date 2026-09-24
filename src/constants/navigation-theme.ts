import { DarkTheme, DefaultTheme } from 'expo-router';

import type { Palette } from '@/constants/theme';

/** expo-router's navigation theme built from our tokens (no stock blues). */
export function navigationTheme(scheme: 'light' | 'dark', c: Palette): typeof DefaultTheme {
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  return {
    ...base,
    colors: {
      ...base.colors,
      primary: c.primary,
      background: c.background,
      card: c.backgroundElement,
      text: c.text,
      border: c.border,
      notification: c.danger,
    },
  };
}
