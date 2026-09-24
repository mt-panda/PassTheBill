import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { pressedStyle } from './button';
import { Icon } from './icon';

type Props = {
  title: string;
  subtitle?: string;
  value?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  chevron?: boolean;
  destructive?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
};

export function ListRow({ title, subtitle, value, leading, trailing, chevron, destructive, onPress, accessibilityLabel }: Props) {
  const theme = useTheme();
  const body = (
    <>
      {leading}
      <View style={styles.text}>
        <ThemedText type="bodyStrong" numberOfLines={1} themeColor={destructive ? 'danger' : 'text'}>
          {title}
        </ThemedText>
        {subtitle ? (
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>
            {subtitle}
          </ThemedText>
        ) : null}
      </View>
      {value ? (
        <ThemedText type="amount" numberOfLines={1} style={styles.value}>
          {value}
        </ThemedText>
      ) : null}
      {trailing ? <View style={styles.value}>{trailing}</View> : null}
      {chevron && <Icon name="forward" size={14} color={theme.textSecondary} />}
    </>
  );
  if (!onPress) return <View style={styles.row}>{body}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? [title, subtitle, value].filter(Boolean).join(', ')}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && pressedStyle]}>
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, minHeight: 56, paddingVertical: Spacing.sm },
  text: { flex: 1, minWidth: 0, gap: 2 },
  value: { flexShrink: 0 },
});
