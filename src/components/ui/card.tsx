import { Pressable, StyleSheet, View, type ViewProps } from 'react-native';

import { Radius, Shadow, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';

import { pressedStyle } from './button';

export type CardTone = 'default' | 'mint' | 'purple' | 'warning';
export type CardProps = ViewProps & { tone?: CardTone; onPress?: () => void };

export function Card({ tone = 'default', onPress, style, children, ...rest }: CardProps) {
  const theme = useTheme();
  const dark = useColorScheme() === 'dark';
  const bg = { default: theme.backgroundElement, mint: theme.mint, purple: theme.accentSoft, warning: theme.warningSoft }[tone];
  const surface = [
    styles.card,
    { backgroundColor: bg },
    tone === 'default' && (dark ? { borderWidth: StyleSheet.hairlineWidth, borderColor: theme.border } : Shadow.card),
    style,
  ];
  if (!onPress) {
    return (
      <View style={surface} {...rest}>
        {children}
      </View>
    );
  }
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [surface, pressed && pressedStyle]} {...rest}>
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { padding: Spacing.lg, borderRadius: Radius.lg, gap: Spacing.md },
});
