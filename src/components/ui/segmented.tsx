import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { Icon, type IconName } from './icon';

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
            <ThemedText type="bodyStrong" themeColor={selected ? 'text' : 'textSecondary'} style={{ fontSize: 14 }}>
              {o.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  segmented: { flexDirection: 'row', padding: 4, borderRadius: Radius.md },
  segment: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    minHeight: 44,
    borderRadius: Radius.sm + 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
