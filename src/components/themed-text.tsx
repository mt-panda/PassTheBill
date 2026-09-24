import { StyleSheet, Text, type TextProps } from 'react-native';

import { Fonts, ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type NewType =
  | 'screenTitle'
  | 'sectionTitle'
  | 'body'
  | 'bodyStrong'
  | 'buttonLabel'
  | 'small'
  | 'caption'
  | 'amountLarge'
  | 'amount'
  | 'teamCode';
/** Older variants still used by onboarding (and 'default'). */
type LegacyType = 'default' | 'smallBold' | 'subtitle';

export type ThemedTextProps = TextProps & { type?: NewType | LegacyType; themeColor?: ThemeColor };

const CAPPED = new Set<ThemedTextProps['type']>(['amountLarge', 'teamCode', 'buttonLabel']);

export function ThemedText({ style, type = 'default', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();
  const color = theme[themeColor ?? 'text'];
  return (
    <Text
      maxFontSizeMultiplier={CAPPED.has(type) ? 1.4 : undefined}
      style={[{ color }, styles[type], style]}
      {...rest}
    />
  );
}

const tabular = { fontVariant: ['tabular-nums' as const] };

const styles = StyleSheet.create({
  screenTitle: { fontSize: 26, lineHeight: 32, fontWeight: '700', letterSpacing: -0.4 },
  sectionTitle: { fontSize: 17, lineHeight: 22, fontWeight: '600' },
  body: { fontSize: 16, lineHeight: 22, fontWeight: '400' },
  bodyStrong: { fontSize: 16, lineHeight: 22, fontWeight: '600' },
  buttonLabel: { fontSize: 19, lineHeight: 24, fontWeight: '700' },
  small: { fontSize: 14, lineHeight: 20, fontWeight: '400' },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '500' },
  amountLarge: { fontSize: 34, lineHeight: 40, fontWeight: '700', letterSpacing: -0.6, ...tabular },
  amount: { fontSize: 16, lineHeight: 22, fontWeight: '600', ...tabular },
  teamCode: { fontSize: 24, lineHeight: 30, fontWeight: '600', letterSpacing: 3, fontFamily: Fonts.mono },
  // legacy
  default: { fontSize: 16, lineHeight: 24, fontWeight: '400' },
  smallBold: { fontSize: 15, lineHeight: 20, fontWeight: '600', letterSpacing: -0.2 },
  subtitle: { fontSize: 26, lineHeight: 32, fontWeight: '700', letterSpacing: -0.6 },
});
