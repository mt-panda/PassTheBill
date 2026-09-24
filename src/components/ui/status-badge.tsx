import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing, type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type Status = 'open' | 'ready' | 'confirmed' | 'waiting' | 'attention' | 'closed' | 'past';

const DEFAULT_LABEL: Record<Status, string> = {
  open: 'Open',
  ready: 'Ready',
  confirmed: 'Confirmed',
  waiting: 'Waiting',
  attention: 'Needs attention',
  closed: 'Closed',
  past: 'Past',
};

const TONE: Record<Status, [bg: ThemeColor, fg: ThemeColor]> = {
  open: ['mint', 'primaryText'],
  ready: ['mint', 'primaryText'],
  confirmed: ['mint', 'primaryText'],
  waiting: ['warningSoft', 'warningText'],
  attention: ['warningSoft', 'warningText'],
  closed: ['backgroundSelected', 'textSecondary'],
  past: ['backgroundSelected', 'textSecondary'],
};

export function StatusBadge({ status, label }: { status: Status; label?: string }) {
  const theme = useTheme();
  const [bg, fg] = TONE[status];
  return (
    <View style={[styles.badge, { backgroundColor: theme[bg] }]}>
      <ThemedText type="caption" themeColor={fg} numberOfLines={1} maxFontSizeMultiplier={1.4}>
        {label ?? DEFAULT_LABEL[status]}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    flexShrink: 1,
    paddingHorizontal: 10,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.pill,
  },
});
