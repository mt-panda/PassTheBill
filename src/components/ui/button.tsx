import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing, type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { Icon, type IconName } from './icon';

type Common = {
  title: string;
  onPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
  icon?: IconName;
  left?: ReactNode;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  /** @deprecated use size="sm"; ignored for primary buttons (contrast rule). */
  small?: boolean;
};

export type ButtonProps = Common &
  ({ variant?: 'primary'; size?: 'md' } | { variant: 'secondary' | 'ghost' | 'danger'; size?: 'md' | 'sm' });

export const pressedStyle = { opacity: 0.8, transform: [{ scale: 0.98 }] };

export function Button(props: ButtonProps) {
  const { title, onPress, disabled, loading, icon, left, style, accessibilityLabel, variant = 'primary' } = props;
  const theme = useTheme();
  const sm = variant !== 'primary' && (props.size === 'sm' || props.small === true);
  const palette: Record<NonNullable<ButtonProps['variant']>, { bg: string; fg: ThemeColor; border?: string }> = {
    primary: { bg: theme.primary, fg: 'onPrimary' },
    secondary: { bg: theme.backgroundElement, fg: 'text', border: theme.border },
    ghost: { bg: 'transparent', fg: 'text' },
    danger: { bg: theme.dangerSoft, fg: 'danger' },
  };
  const p = palette[variant];
  const inactive = !!disabled || !!loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: inactive, busy: !!loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        sm ? styles.sm : styles.md,
        { backgroundColor: p.bg },
        p.border ? { borderWidth: 1, borderColor: p.border } : null,
        inactive && styles.disabled,
        pressed && pressedStyle,
        style,
      ]}>
      {loading ? <ActivityIndicator color={theme[p.fg]} /> : left}
      {!loading && icon && <Icon name={icon} size={sm ? 16 : 20} color={p.fg} />}
      <ThemedText
        type={variant === 'primary' ? 'buttonLabel' : 'bodyStrong'}
        themeColor={p.fg}
        numberOfLines={1}
        style={[{ flexShrink: 1 }, sm && { fontSize: 14 }]}>
        {title}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    borderRadius: Radius.button,
  },
  md: { minHeight: 52, paddingHorizontal: Spacing.xl },
  sm: { minHeight: 40, paddingHorizontal: Spacing.md, borderRadius: Radius.md },
  disabled: { opacity: 0.4 },
});
