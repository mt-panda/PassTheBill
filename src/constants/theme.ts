import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#13231C',
    textSecondary: '#5E6E66',
    background: '#F4F1EA',
    backgroundElement: '#FFFDF8',
    backgroundSelected: '#E9E5DA',
    border: '#E1DCCF',
    primary: '#1E4D3B',
    onPrimary: '#F4F1EA',
    success: '#2B7A52',
    successSoft: '#DDEEE2',
    warning: '#94600A',
    warningSoft: '#F6EAD3',
    danger: '#B63B2C',
    dangerSoft: '#F6E2DD',
  },
  dark: {
    text: '#E9EFEB',
    textSecondary: '#91A199',
    background: '#0C1512',
    backgroundElement: '#13201B',
    backgroundSelected: '#1C2C25',
    border: '#22342C',
    primary: '#9ED2B8',
    onPrimary: '#0C1512',
    success: '#7FDCA8',
    successSoft: '#13291F',
    warning: '#EDC06A',
    warningSoft: '#2A2312',
    danger: '#F29384',
    dangerSoft: '#2D1814',
  },
} as const;

export const Brand = { pine: '#1E4D3B', cream: '#F4F1EA' } as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
