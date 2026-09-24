import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#151625',
    textSecondary: '#617087',
    textMuted: '#95A4BA',
    background: '#FCFCFD',
    backgroundElement: '#FFFFFF',
    backgroundSelected: '#F1F5F9',
    border: '#E4E9F0',
    primary: '#0A9665',
    primaryAlt: '#2CAC7F',
    primaryText: '#087A52',
    onPrimary: '#FFFFFF',
    success: '#0A9665',
    successSoft: '#E5F7F0',
    mint: '#E5F7F0',
    accent: '#7C68E8',
    accentText: '#5B47C9',
    accentSoft: '#EDE9FF',
    warning: '#F1AD4A',
    warningText: '#8A5300',
    warningSoft: '#FEF4E4',
    danger: '#D82323',
    dangerSoft: '#FFF0F0',
    scrim: 'rgba(21,22,37,0.40)',
  },
  dark: {
    text: '#F1F4F8',
    textSecondary: '#A3AFBF',
    textMuted: '#6F7C8E',
    background: '#101418',
    backgroundElement: '#181D23',
    backgroundSelected: '#222932',
    border: '#2C343E',
    primary: '#0A9665',
    primaryAlt: '#2CAC7F',
    primaryText: '#3CCB94',
    onPrimary: '#FFFFFF',
    success: '#3CCB94',
    successSoft: '#12352A',
    mint: '#12352A',
    accent: '#A897FF',
    accentText: '#B4A6FF',
    accentSoft: '#2A2550',
    warning: '#F1AD4A',
    warningText: '#F6C46F',
    warningSoft: '#3A2C12',
    danger: '#FF7A7A',
    dangerSoft: '#3A1A1C',
    scrim: 'rgba(0,0,0,0.55)',
  },
} as const;

/** JS splash only; it matches the native pine splash until the 1.1.0 native build. */
export const Brand = { pine: '#1E4D3B', cream: '#F4F1EA' } as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;
export type Palette = (typeof Colors)['light'] | (typeof Colors)['dark'];

export const Fonts = Platform.select({
  ios: { sans: 'system-ui', serif: 'ui-serif', rounded: 'ui-rounded', mono: 'ui-monospace' },
  default: { sans: 'normal', serif: 'serif', rounded: 'normal', mono: 'monospace' },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 } as const;

export const Radius = { sm: 8, md: 12, button: 14, lg: 16, xl: 24, pill: 999 } as const;

/** Light-mode card elevation. Dark mode uses a hairline border instead (see Card). */
export const Shadow = {
  card:
    Platform.select({
      android: { elevation: 2 },
      default: { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
    }) ?? {},
};

export const screenPadding = (width: number) => (width < 360 ? Spacing.lg : Spacing.xl);

export const MaxContentWidth = 800;
