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
import { Avatar, Badge, Button, Card, Divider, IconButton, Row } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { money, useSession } from '@/lib/session';

function OrderArt() {
  const line = (name: string, qty: number, price: number) => (
    <Row>
      <ThemedText type="small">{name}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {qty} × {money(price)}
      </ThemedText>
    </Row>
  );
  return (
    <Card>
      <Row>
        <ThemedText type="smallBold">KFC · Lunch</ThemedText>
        <Badge tone="warning">Open</Badge>
      </Row>
      <Divider />
      {line('Zinger burger', 3, 650)}
      {line('Hot wings', 2, 450)}
      {line('Fries', 4, 250)}
      <Divider />
      <Row>
        <ThemedText type="smallBold">Total bill</ThemedText>
        <ThemedText type="smallBold">{money(3 * 650 + 2 * 450 + 4 * 250 + 150)}</ThemedText>
      </Row>
    </Card>
  );
}

function ClaimArt() {
  const theme = useTheme();
  return (
    <View style={{ gap: 12 }}>
      <Card style={{ borderColor: theme.primary, borderWidth: 1.5 }}>
        <Row>
          <View style={{ gap: 2 }}>
            <ThemedText type="smallBold">Zinger burger</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {money(650)} each · 3 ordered
            </ThemedText>
          </View>
          <Badge tone="success" icon="check">
            All claimed
          </Badge>
        </Row>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          <Badge>You × 1</Badge>
          <Badge>Sara × 1</Badge>
          <Badge>Ahmed × 1</Badge>
        </View>
        <Divider />
        <Row>
          <ThemedText type="small">You had 1</ThemedText>
          <Row>
            <IconButton icon="remove" label="Unclaim" />
            <ThemedText type="smallBold">1</ThemedText>
            <IconButton icon="add" label="Claim" primary />
          </Row>
        </Row>
      </Card>
      <Card style={{ backgroundColor: theme.primary, borderColor: theme.primary }}>
        <Row>
          <ThemedText type="label" themeColor="onPrimary">
            You pay
          </ThemedText>
          <ThemedText type="subtitle" themeColor="onPrimary" style={{ fontSize: 22 }}>
            {money(700)}
          </ThemedText>
        </Row>
      </Card>
    </View>
  );
}

function SettleArt() {
  const person = (name: string, amount: number, paid: boolean) => (
    <Row>
      <Row style={{ flexShrink: 1 }}>
        <Avatar name={name} />
        <View style={{ gap: 2 }}>
          <ThemedText type="smallBold">{name}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {money(amount)}
          </ThemedText>
        </View>
      </Row>
      {paid ? (
        <Badge tone="success" icon="check">
          Paid
        </Badge>
      ) : (
        <Badge tone="warning">Not paid yet</Badge>
      )}
    </Row>
  );
  return (
    <Card>
      <Row>
        <ThemedText type="label" themeColor="textSecondary">
          September
        </ThemedText>
        <ThemedText type="smallBold">{money(18400)}</ThemedText>
      </Row>
      <Divider />
      {person('Sara Ali', 6200, true)}
      {person('Ahmed Raza', 5750, false)}
      {person('Bilal Khan', 6450, true)}
    </Card>
  );
}

const slides: { title: string; body: string; art: ReactNode }[] = [
  {
    title: 'One person adds the order',
    body: 'Whoever orders lunch enters the items and prices once. No more screenshots in the group chat.',
    art: <OrderArt />,
  },
  {
    title: 'Everyone taps what they ate',
    body: 'Teammates claim their own items. The delivery fee is split evenly between everyone who ate.',
    art: <ClaimArt />,
  },
  {
    title: 'Settle up once a month',
    body: 'See exactly who owes what this month, and mark people as paid when they pay you back.',
    art: <SettleArt />,
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
