import { View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

export const initials = (name: string | null | undefined) =>
  (name ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('') || '?';

export function Avatar({ name, size = 36 }: { name: string | null | undefined; size?: number }) {
  const theme = useTheme();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: theme.mint,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <ThemedText
        type="bodyStrong"
        themeColor="primaryText"
        maxFontSizeMultiplier={1.2}
        style={{ fontSize: size * 0.38, lineHeight: size * 0.5 }}>
        {initials(name)}
      </ThemedText>
    </View>
  );
}
