import { useEffect } from 'react';
import { View, type DimensionValue } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = { height: number; width?: DimensionValue; radius?: number };

export function Skeleton({ height, width = '100%', radius = Radius.md }: Props) {
  const theme = useTheme();
  const pulse = useSharedValue(0.55);
  useEffect(() => {
    pulse.set(withRepeat(withTiming(1, { duration: 600 }), -1, true));
  }, [pulse]);
  const style = useAnimatedStyle(() => ({ opacity: pulse.get() }));
  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[{ height, width, borderRadius: radius, backgroundColor: theme.backgroundSelected }, style]}
    />
  );
}

Skeleton.Row = function SkeletonRow() {
  return (
    <View style={{ flexDirection: 'row', gap: Spacing.md, alignItems: 'center', paddingVertical: Spacing.sm }}>
      <Skeleton height={44} width={44} radius={Radius.md} />
      <View style={{ flex: 1, gap: Spacing.sm }}>
        <Skeleton height={14} width="60%" />
        <Skeleton height={12} width="40%" />
      </View>
    </View>
  );
};

Skeleton.Card = function SkeletonCard() {
  return <Skeleton height={148} radius={Radius.lg} />;
};
