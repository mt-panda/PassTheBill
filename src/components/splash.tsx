import { NavigationBar } from 'expo-navigation-bar';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { Brand } from '@/constants/theme';

export function Receipt({ size, ink, paper }: { size: number; ink: string; paper: string }) {
  const u = size / 100;
  const line = (width: number) => (
    <View style={{ width: width * u, height: 5 * u, borderRadius: 3 * u, backgroundColor: paper }} />
  );
  return (
    <View
      style={{
        width: 44 * u,
        height: 54 * u,
        borderRadius: 7 * u,
        backgroundColor: ink,
        padding: 9 * u,
        gap: 6 * u,
      }}>
      {line(22)}
      {line(16)}
      <View style={{ flex: 1 }} />
      {line(26)}
    </View>
  );
}

export function LogoMark({ size = 56, tile, ink }: { size?: number; tile: string; ink: string }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.3,
        backgroundColor: tile,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <Receipt size={size} ink={ink} paper={tile} />
    </View>
  );
}

const LOGO = 104;
const out = Easing.out(Easing.cubic);

export function AnimatedSplash({ ready, onDone }: { ready: boolean; onDone: () => void }) {
  const halves = useSharedValue(0);
  const receipt = useSharedValue(0);
  const ring = useSharedValue(0);
  const title = useSharedValue(0);
  const tagline = useSharedValue(0);
  const exit = useSharedValue(0);

  useEffect(() => {
    if (!ready) return;
    halves.set(withSpring(1, { damping: 15, stiffness: 110 }));
    receipt.set(withDelay(380, withSpring(1, { damping: 10, stiffness: 150 })));
    ring.set(withDelay(420, withTiming(1, { duration: 1000, easing: out })));
    title.set(withDelay(600, withTiming(1, { duration: 550, easing: out })));
    tagline.set(withDelay(800, withTiming(1, { duration: 550, easing: out })));
    exit.set(withDelay(1850, withTiming(1, { duration: 420, easing: Easing.in(Easing.cubic) })));
    const t = setTimeout(onDone, 2300);
    return () => clearTimeout(t);
  }, [ready]);

  const leftStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, halves.get() * 1.5),
    transform: [{ translateX: (halves.get() - 1) * 64 }, { rotate: `${(halves.get() - 1) * 14}deg` }],
  }));
  const rightStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, halves.get() * 1.5),
    transform: [{ translateX: (1 - halves.get()) * 64 }, { rotate: `${(1 - halves.get()) * 14}deg` }],
  }));
  const receiptStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, receipt.get() * 2),
    transform: [{ scale: 0.4 + receipt.get() * 0.6 }, { translateY: (1 - receipt.get()) * 10 }],
  }));
  const ringStyle = useAnimatedStyle(() => ({
    opacity: ring.get() > 0 ? 0.3 * (1 - ring.get()) : 0,
    transform: [{ scale: 1 + ring.get() * 1.8 }],
  }));
  const titleStyle = useAnimatedStyle(() => ({
    opacity: title.get(),
    transform: [{ translateY: (1 - title.get()) * 14 }],
  }));
  const taglineStyle = useAnimatedStyle(() => ({
    opacity: tagline.get(),
    transform: [{ translateY: (1 - tagline.get()) * 14 }],
  }));
  const containerStyle = useAnimatedStyle(() => ({ opacity: 1 - exit.get() }));
  const contentStyle = useAnimatedStyle(() => ({ transform: [{ scale: 1 + exit.get() * 0.08 }] }));

  return (
    <Animated.View style={[StyleSheet.absoluteFill, s.root, containerStyle]} pointerEvents="none">
      <StatusBar style="light" />
      <NavigationBar style="light" />
      <Animated.View style={[s.center, contentStyle]}>
        <View style={s.logo}>
          <Animated.View style={[s.ring, ringStyle]} />
          <Animated.View style={[s.half, s.left, leftStyle]} />
          <Animated.View style={[s.half, s.right, rightStyle]} />
          <Animated.View style={receiptStyle}>
            <Receipt size={LOGO} ink={Brand.pine} paper={Brand.cream} />
          </Animated.View>
        </View>
        <Animated.View style={titleStyle}>
          <Text style={s.title}>
            PassThe<Text style={{ color: Brand.cream + '99' }}>Bill</Text>
          </Text>
        </Animated.View>
        <Animated.View style={taglineStyle}>
          <Text style={s.tagline}>Split lunch, not friendships.</Text>
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  root: { backgroundColor: Brand.pine, zIndex: 100, alignItems: 'center', justifyContent: 'center' },
  center: { alignItems: 'center' },
  logo: { width: LOGO, height: LOGO, alignItems: 'center', justifyContent: 'center', marginBottom: 28 },
  ring: {
    position: 'absolute',
    width: LOGO,
    height: LOGO,
    borderRadius: LOGO / 2,
    borderWidth: 2,
    borderColor: Brand.cream,
  },
  half: { position: 'absolute', top: 0, width: LOGO / 2 + 1, height: LOGO, backgroundColor: Brand.cream },
  left: { left: 0, borderTopLeftRadius: LOGO * 0.3, borderBottomLeftRadius: LOGO * 0.3 },
  right: { right: 0, borderTopRightRadius: LOGO * 0.3, borderBottomRightRadius: LOGO * 0.3 },
  title: { color: Brand.cream, fontSize: 34, fontWeight: '700', letterSpacing: -1 },
  tagline: { color: Brand.cream + 'B3', fontSize: 15, marginTop: 8 },
});
