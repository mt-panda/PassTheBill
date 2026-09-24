import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { Button } from './button';
import { Icon, type IconName } from './icon';

type Props = { icon?: IconName; emoji?: string; title: string; text: string; action?: { label: string; onPress: () => void } };

export function EmptyState({ icon, emoji, title, text, action }: Props) {
  const theme = useTheme();
  return (
    <View style={styles.empty}>
      {emoji ? (
        <ThemedText style={{ fontSize: 44, lineHeight: 52 }} accessibilityElementsHidden importantForAccessibility="no">
          {emoji}
        </ThemedText>
      ) : icon ? (
        <View style={[styles.icon, { backgroundColor: theme.backgroundSelected }]}>
          <Icon name={icon} size={28} color="textSecondary" />
        </View>
      ) : null}
      <ThemedText type="sectionTitle" style={{ textAlign: 'center' }}>
        {title}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center', maxWidth: 300 }}>
        {text}
      </ThemedText>
      {action && (
        <Button title={action.label} icon="add" onPress={action.onPress} style={{ marginTop: Spacing.sm, alignSelf: 'stretch' }} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { alignItems: 'center', gap: Spacing.sm, paddingVertical: 48 },
  icon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
});
