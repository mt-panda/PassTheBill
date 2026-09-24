import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

import { IconButton } from './icon-button';

type Props = { value: number; onChange: (value: number) => void; min?: number; max?: number; pending?: boolean; itemName: string };

export function QuantityStepper({ value, onChange, min = 0, max = Infinity, pending, itemName }: Props) {
  return (
    <View style={styles.row}>
      <IconButton
        icon="remove"
        size={44}
        label={`Remove one ${itemName}`}
        disabled={pending || value <= min}
        onPress={() => onChange(value - 1)}
      />
      <ThemedText type="amount" accessibilityLiveRegion="polite" style={styles.value} maxFontSizeMultiplier={1.4}>
        {value}
      </ThemedText>
      <IconButton
        icon="add"
        size={44}
        primary
        label={`Add one ${itemName}`}
        disabled={pending || value >= max}
        onPress={() => onChange(value + 1)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  value: { minWidth: 28, textAlign: 'center' },
});
