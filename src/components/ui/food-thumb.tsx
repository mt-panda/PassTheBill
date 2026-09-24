import { Image } from 'expo-image';
import { ActivityIndicator, View } from 'react-native';

import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { Icon } from './icon';

/** Fixed-size (64) food thumbnail; the layout never jumps when the picture arrives. */
export function FoodThumb({ uri, loading, size = 64 }: { uri?: string | null; loading?: boolean; size?: number }) {
  const theme = useTheme();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: Radius.md,
        overflow: 'hidden',
        backgroundColor: theme.backgroundSelected,
        alignItems: 'center',
        justifyContent: 'center',
      }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      {uri ? (
        <Image
          source={{ uri }}
          style={{ width: size, height: size }}
          contentFit="cover"
          transition={150}
          cachePolicy="memory-disk"
          recyclingKey={uri}
        />
      ) : loading ? (
        <ActivityIndicator color={theme.textSecondary} />
      ) : (
        <Icon name="food" size={Math.round(size * 0.4)} color="textSecondary" />
      )}
    </View>
  );
}
