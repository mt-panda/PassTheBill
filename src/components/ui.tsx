import { SymbolView, type AndroidSymbol, type SFSymbol } from 'expo-symbols';
import { useState, type ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewProps,
  type ViewStyle,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const sym = (ios: SFSymbol, android: AndroidSymbol) => ({ ios, android, web: android });

const icons = {
  add: sym('plus', 'add'),
  remove: sym('minus', 'remove'),
  close: sym('xmark', 'close'),
  share: sym('square.and.arrow.up', 'share'),
  chart: sym('chart.bar.fill', 'bar_chart'),
  back: sym('chevron.left', 'chevron_left'),
  forward: sym('chevron.right', 'chevron_right'),
  edit: sym('pencil', 'edit'),
  delete: sym('trash', 'delete'),
  food: sym('fork.knife', 'restaurant'),
  check: sym('checkmark', 'check'),
  lock: sym('lock.fill', 'lock'),
  people: sym('person.2.fill', 'group'),
  info: sym('info.circle', 'info'),
  money: sym('banknote', 'payments'),
  signOut: sym('rectangle.portrait.and.arrow.right', 'logout'),
  sun: sym('sun.max.fill', 'light_mode'),
  moon: sym('moon.fill', 'dark_mode'),
  phone: sym('iphone', 'smartphone'),
};

export type IconName = keyof typeof icons;

export const Icon = ({ name, size = 20, color }: { name: IconName; size?: number; color?: ThemeColor }) => {
  const theme = useTheme();
  return <SymbolView name={icons[name]} size={size} tintColor={theme[color ?? 'text']} />;
};

const pressedStyle = { opacity: 0.75, transform: [{ scale: 0.98 }] };

type ButtonProps = {
  title: string;
  onPress?: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  icon?: IconName;
  small?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Button({ title, onPress, disabled, variant = 'primary', icon, small, style }: ButtonProps) {
  const theme = useTheme();
  const variants: Record<typeof variant, [string, ThemeColor]> = {
    primary: [theme.primary, 'onPrimary'],
    secondary: [theme.backgroundSelected, 'text'],
    ghost: ['transparent', 'text'],
    danger: [theme.dangerSoft, 'danger'],
  };
  const [bg, fg] = variants[variant];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        small && styles.buttonSmall,
        { backgroundColor: bg },
        disabled && styles.disabled,
        pressed && pressedStyle,
        style,
      ]}>
      {icon && <Icon name={icon} size={small ? 16 : 18} color={fg} />}
      <ThemedText type="smallBold" themeColor={fg} style={small && { fontSize: 14 }}>
        {title}
      </ThemedText>
    </Pressable>
  );
}

type IconButtonProps = {
  icon: IconName;
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  primary?: boolean;
};

export function IconButton({ icon, label, onPress, disabled, primary }: IconButtonProps) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      hitSlop={6}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.iconButton,
        { backgroundColor: primary ? theme.primary : theme.backgroundSelected },
        disabled && styles.disabled,
        pressed && pressedStyle,
      ]}>
      <Icon name={icon} size={18} color={primary ? 'onPrimary' : 'text'} />
    </Pressable>
  );
}

type InputProps = Omit<TextInputProps, 'style'> & { label?: string; hint?: string; style?: StyleProp<ViewStyle> };

export function Input({ label, hint, style, ...props }: InputProps) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View style={[styles.field, style]}>
      {label && (
        <ThemedText type="smallBold" style={{ fontSize: 14 }}>
          {label}
        </ThemedText>
      )}
      <TextInput
        placeholderTextColor={theme.textSecondary}
        {...props}
        onFocus={(e) => (setFocused(true), props.onFocus?.(e))}
        onBlur={(e) => (setFocused(false), props.onBlur?.(e))}
        style={[
          styles.input,
          { color: theme.text, backgroundColor: theme.background, borderColor: focused ? theme.primary : theme.border },
        ]}
      />
      {hint && (
        <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 13 }}>
          {hint}
        </ThemedText>
      )}
    </View>
  );
}

export function Card({ style, ...props }: ViewProps) {
  const theme = useTheme();
  return (
    <View
      style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }, style]}
      {...props}
    />
  );
}

export const Row = ({ style, ...props }: ViewProps) => <View style={[styles.row, style]} {...props} />;

type Tone = 'neutral' | 'success' | 'warning' | 'danger';

export function Badge({ tone = 'neutral', icon, children }: { tone?: Tone; icon?: IconName; children: ReactNode }) {
  const theme = useTheme();
  const [bg, fg]: [string, ThemeColor] =
    tone === 'neutral' ? [theme.backgroundSelected, 'textSecondary'] : [theme[`${tone}Soft`], tone];
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      {icon && <Icon name={icon} size={12} color={fg} />}
      <ThemedText type="smallBold" themeColor={fg} style={{ fontSize: 12, lineHeight: 16 }}>
        {children}
      </ThemedText>
    </View>
  );
}

export function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const theme = useTheme();
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
  return (
    <View
      style={[
        styles.avatar,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: theme.backgroundSelected },
      ]}>
      <ThemedText type="smallBold" style={{ fontSize: size * 0.38 }}>
        {initials || '?'}
      </ThemedText>
    </View>
  );
}

export function EmptyState({ icon, title, text }: { icon: IconName; title: string; text: string }) {
  const theme = useTheme();
  return (
    <View style={styles.empty}>
      <View style={[styles.emptyIcon, { backgroundColor: theme.backgroundSelected }]}>
        <Icon name={icon} size={28} color="textSecondary" />
      </View>
      <ThemedText type="smallBold" style={{ fontSize: 18 }}>
        {title}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center', maxWidth: 300 }}>
        {text}
      </ThemedText>
    </View>
  );
}

type SegmentedProps<T extends string> = {
  options: { value: T; label: string; icon?: IconName }[];
  value: T;
  onChange: (value: T) => void;
};

export function Segmented<T extends string>({ options, value, onChange }: SegmentedProps<T>) {
  const theme = useTheme();
  return (
    <View style={[styles.segmented, { backgroundColor: theme.backgroundSelected }]}>
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onChange(o.value)}
            style={[styles.segment, selected && { backgroundColor: theme.backgroundElement }]}>
            {o.icon && <Icon name={o.icon} size={16} color={selected ? 'text' : 'textSecondary'} />}
            <ThemedText type="smallBold" themeColor={selected ? 'text' : 'textSecondary'} style={{ fontSize: 14 }}>
              {o.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Divider() {
  const theme = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: theme.border }} />;
}

export const styles = StyleSheet.create({
  screen: {
    padding: 20,
    gap: 16,
    paddingBottom: 48,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  section: { marginTop: 8, marginBottom: -4, marginLeft: 4 },
  field: { gap: 8 },
  input: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 16,
  },
  card: { padding: 18, borderRadius: 22, gap: 14, borderWidth: StyleSheet.hairlineWidth },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 54,
    paddingHorizontal: 20,
    borderRadius: 16,
  },
  buttonSmall: { minHeight: 38, paddingHorizontal: 14, borderRadius: 12, gap: 6 },
  iconButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.35 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  avatar: { alignItems: 'center', justifyContent: 'center' },
  segmented: { flexDirection: 'row', padding: 4, borderRadius: 14 },
  segment: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: { alignItems: 'center', gap: 10, paddingVertical: 48 },
  emptyIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
});
