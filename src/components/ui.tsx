import { StyleSheet, TextInput, View, type TextInputProps, type ViewProps } from 'react-native';

import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function Input({ style, ...props }: TextInputProps) {
  const theme = useTheme();
  return (
    <TextInput
      placeholderTextColor={theme.textSecondary}
      style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }, style]}
      {...props}
    />
  );
}

export const Card = ({ style, ...props }: ViewProps) => (
  <ThemedView type="backgroundElement" style={[styles.card, style]} {...props} />
);

export const Row = ({ style, ...props }: ViewProps) => <View style={[styles.row, style]} {...props} />;

export const styles = StyleSheet.create({
  screen: { padding: Spacing.three, gap: Spacing.three, paddingBottom: Spacing.six },
  input: {
    borderWidth: 1,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 16,
  },
  card: { padding: Spacing.three, borderRadius: Spacing.three, gap: Spacing.two },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.four },
});
