// Older pieces still in use: Row (layout helper) and Badge (onboarding chips).
import type { ReactNode } from 'react';
import { StyleSheet, View, type ViewProps } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { Icon, type IconName } from './icon';

export const Row = ({ style, ...props }: ViewProps) => <View style={[styles.row, style]} {...props} />;

type Tone = 'neutral' | 'success' | 'warning' | 'danger';

const TEXT_TONE = { success: 'primaryText', warning: 'warningText', danger: 'danger' } as const;

export function Badge({ tone = 'neutral', icon, children }: { tone?: Tone; icon?: IconName; children: ReactNode }) {
  const theme = useTheme();
  const [bg, fg]: [string, ThemeColor] =
    tone === 'neutral' ? [theme.backgroundSelected, 'textSecondary'] : [theme[`${tone}Soft`], TEXT_TONE[tone]];
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      {icon && <Icon name={icon} size={12} color={fg} />}
      <ThemedText type="caption" themeColor={fg} numberOfLines={1} style={{ flexShrink: 1 }}>
        {children}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    flexShrink: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
});
