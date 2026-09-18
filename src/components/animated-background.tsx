import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

export function AnimatedBackground() {
  const theme = useTheme();

  const first = useRef(new Animated.Value(0)).current;
  const second = useRef(new Animated.Value(0)).current;
  const third = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animations = [
      Animated.loop(
        Animated.sequence([
          Animated.timing(first, {
            toValue: 1,
            duration: 9000,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(first, {
            toValue: 0,
            duration: 9000,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ])
      ),
      Animated.loop(
        Animated.sequence([
          Animated.timing(second, {
            toValue: 1,
            duration: 11500,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(second, {
            toValue: 0,
            duration: 11500,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ])
      ),
      Animated.loop(
        Animated.sequence([
          Animated.timing(third, {
            toValue: 1,
            duration: 13500,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(third, {
            toValue: 0,
            duration: 13500,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ])
      ),
    ];

    animations.forEach((animation) => animation.start());

    return () => animations.forEach((animation) => animation.stop());
  }, [first, second, third]);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Animated.View
        style={[
          styles.blob,
          styles.topLeft,
          {
            backgroundColor: theme.primary,
            opacity: 0.055,
            transform: [
              {
                translateX: first.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-18, 30],
                }),
              },
              {
                translateY: first.interpolate({
                  inputRange: [0, 1],
                  outputRange: [10, 55],
                }),
              },
              {
                scale: first.interpolate({
                  inputRange: [0, 1],
                  outputRange: [1, 1.12],
                }),
              },
            ],
          },
        ]}
      />

      <Animated.View
        style={[
          styles.blob,
          styles.right,
          {
            backgroundColor: theme.success,
            opacity: 0.045,
            transform: [
              {
                translateX: second.interpolate({
                  inputRange: [0, 1],
                  outputRange: [18, -35],
                }),
              },
              {
                translateY: second.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-15, 35],
                }),
              },
              {
                scale: second.interpolate({
                  inputRange: [0, 1],
                  outputRange: [1.05, 0.9],
                }),
              },
            ],
          },
        ]}
      />

      <Animated.View
        style={[
          styles.blob,
          styles.bottom,
          {
            backgroundColor: theme.primary,
            opacity: 0.035,
            transform: [
              {
                translateX: third.interpolate({
                  inputRange: [0, 1],
                  outputRange: [30, -25],
                }),
              },
              {
                translateY: third.interpolate({
                  inputRange: [0, 1],
                  outputRange: [20, -30],
                }),
              },
              {
                scale: third.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.92, 1.08],
                }),
              },
            ],
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  blob: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
  },
  topLeft: {
    top: -95,
    left: -100,
  },
  right: {
    top: '32%',
    right: -145,
  },
  bottom: {
    bottom: -130,
    left: '28%',
  },
});
