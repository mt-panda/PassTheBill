import { useState } from 'react';
import {
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type InputProps = Omit<TextInputProps, 'style'> & {
  label?: string;
  hint?: string;
  error?: string;
  /** Styles the wrapper (label + field + hint). */
  style?: StyleProp<ViewStyle>;
  /** Styles the text field itself. */
  inputStyle?: StyleProp<TextStyle>;
};

export function Input({ label, hint, error, style, inputStyle, ...props }: InputProps) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View style={[styles.field, style]}>
      {label && (
        <ThemedText type="bodyStrong" style={{ fontSize: 14 }}>
          {label}
        </ThemedText>
      )}
      <TextInput
        placeholderTextColor={theme.textMuted}
        accessibilityLabel={props.accessibilityLabel ?? label}
        {...props}
        onFocus={(e) => (setFocused(true), props.onFocus?.(e))}
        onBlur={(e) => (setFocused(false), props.onBlur?.(e))}
        style={[
          styles.input,
          {
            color: theme.text,
            backgroundColor: theme.backgroundSelected,
            borderColor: error ? theme.danger : focused ? theme.primary : theme.border,
          },
          inputStyle,
        ]}
      />
      {error ? (
        <ThemedText type="small" themeColor="danger" accessibilityLiveRegion="polite">
          {error}
        </ThemedText>
      ) : hint ? (
        <ThemedText type="small" themeColor="textSecondary">
          {hint}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: Spacing.sm },
  input: {
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: 14,
    paddingVertical: Spacing.md,
    fontSize: 16,
    minHeight: 48,
  },
});
