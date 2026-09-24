import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

export function SectionHeader({ title, action }: { title: string; action?: { label: string; onPress: () => void } }) {
  return (
    <View style={styles.row}>
      <ThemedText type="sectionTitle" numberOfLines={1} style={{ flexShrink: 1 }} accessibilityRole="header">
        {title}
      </ThemedText>
      {action && (
        <Pressable accessibilityRole="button" hitSlop={12} onPress={action.onPress}>
          <ThemedText type="bodyStrong" themeColor="primaryText">
            {action.label}
          </ThemedText>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.md, marginTop: Spacing.sm },
});
