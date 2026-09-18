import { useState, type ReactNode } from 'react';
import { useWindowDimensions, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedReaction,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { LogoMark } from '@/components/splash';
import { ThemedText } from '@/components/themed-text';
import { Badge, Button, Icon, Row, type IconName } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { useSession } from '@/lib/session';

function Hero({ icon, chips }: { icon: IconName; chips: string[] }) {
  const theme = useTheme();
  return (
    <View style={{ alignItems: 'center', gap: 22 }}>
      <View
        style={{
          width: 180,
          height: 180,
          borderRadius: 90,
          backgroundColor: theme.backgroundSelected,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <View
          style={{
            width: 104,
            height: 104,
            borderRadius: 32,
            backgroundColor: theme.primary,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Icon name={icon} size={48} color="onPrimary" />
        </View>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 }}>
        {chips.map((c) => (
          <Badge key={c}>{c}</Badge>
        ))}
      </View>
    </View>
  );
}

const slides: { title: string; body: string; art: ReactNode }[] = [
  {
    title: 'Add lunch once',
    body: 'Whoever orders types in what was bought. That is the only typing anyone does.',
    art: <Hero icon="receipt" chips={['Zinger × 3', 'Fries × 4', 'Delivery']} />,
  },
  {
    title: 'Tap what you ate',
    body: 'Everyone taps + on their food. The app splits the delivery fee for you.',
    art: <Hero icon="tap" chips={['You × 1', 'Sara × 1', 'Ahmed × 1']} />,
  },
  {
    title: 'Pay once a month',
    body: 'At the end of the month, see who owes what and mark people as paid.',
    art: <Hero icon="money" chips={['Sara · Paid', 'Ahmed · Rs 5,750']} />,
  },
];

function Page({ i, x, width }: { i: number; x: SharedValue<number>; width: number }) {
  const range = [(i - 1) * width, i * width, (i + 1) * width];
  const artStyle = useAnimatedStyle(() => ({
    opacity: interpolate(x.get(), range, [0, 1, 0], Extrapolation.CLAMP),
    transform: [
      { translateX: interpolate(x.get(), range, [width * 0.3, 0, -width * 0.3], Extrapolation.CLAMP) },
      { rotate: `${interpolate(x.get(), range, [6, 0, -6], Extrapolation.CLAMP)}deg` },
      { scale: interpolate(x.get(), range, [0.88, 1, 0.88], Extrapolation.CLAMP) },
    ],
  }));
  const textStyle = useAnimatedStyle(() => ({
    opacity: interpolate(x.get(), range, [0, 1, 0], Extrapolation.CLAMP),
    transform: [{ translateX: interpolate(x.get(), range, [width * 0.15, 0, -width * 0.15], Extrapolation.CLAMP) }],
  }));

  return (
    <View style={{ width, paddingHorizontal: 24, alignItems: 'center' }}>
      <View style={{ flex: 1, justifyContent: 'center', width: '100%', maxWidth: 360 }}>
        <Animated.View style={artStyle} pointerEvents="none">
          {slides[i].art}
        </Animated.View>
      </View>
      <Animated.View style={[{ gap: 10, minHeight: 140, width: '100%', maxWidth: 440 }, textStyle]}>
        <ThemedText type="subtitle" style={{ fontSize: 30, lineHeight: 36 }}>
          {slides[i].title}
        </ThemedText>
        <ThemedText themeColor="textSecondary">{slides[i].body}</ThemedText>
      </Animated.View>
    </View>
  );
}

function Dot({ i, x, width }: { i: number; x: SharedValue<number>; width: number }) {
  const theme = useTheme();
  const style = useAnimatedStyle(() => {
    const range = [(i - 1) * width, i * width, (i + 1) * width];
    return {
      width: interpolate(x.get(), range, [8, 28, 8], Extrapolation.CLAMP),
      opacity: interpolate(x.get(), range, [0.25, 1, 0.25], Extrapolation.CLAMP),
    };
  });
  return <Animated.View style={[{ height: 8, borderRadius: 4, backgroundColor: theme.primary }, style]} />;
}

export default function OnboardingScreen() {
  const { finishOnboarding } = useSession();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const ref = useAnimatedRef<Animated.ScrollView>();
  const x = useSharedValue(0);
  const [index, setIndex] = useState(0);
  const last = index === slides.length - 1;

  const onScroll = useAnimatedScrollHandler((e) => x.set(e.contentOffset.x));
  useAnimatedReaction(
    () => Math.round(x.get() / width),
    (now, before) => {
      if (now !== before) scheduleOnRN(setIndex, now);
    }
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.background, paddingTop: insets.top, paddingBottom: insets.bottom + 16 }}>
      <Row style={{ paddingHorizontal: 20, height: 56 }}>
        <Row style={{ gap: 10 }}>
          <LogoMark size={32} tile={theme.primary} ink={theme.onPrimary} />
          <ThemedText type="smallBold" style={{ fontSize: 17 }}>
            PassTheBill
          </ThemedText>
        </Row>
        {!last && <Button title="Skip" variant="ghost" small onPress={finishOnboarding} />}
      </Row>

      <Animated.ScrollView
        ref={ref}
        horizontal
        pagingEnabled
        bounces={false}
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        style={{ flex: 1 }}>
        {slides.map((_, i) => (
          <Page key={i} i={i} x={x} width={width} />
        ))}
      </Animated.ScrollView>

      <View style={{ paddingHorizontal: 20, gap: 24, width: '100%', maxWidth: 520, alignSelf: 'center' }}>
        <Row style={{ justifyContent: 'center', gap: 6 }}>
          {slides.map((_, i) => (
            <Dot key={i} i={i} x={x} width={width} />
          ))}
        </Row>
        <Button
          title={last ? 'Get started' : 'Next'}
          onPress={() => (last ? finishOnboarding() : ref.current?.scrollTo({ x: (index + 1) * width, animated: true }))}
        />
      </View>
    </View>
  );
}
