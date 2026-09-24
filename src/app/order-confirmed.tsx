import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { Button, Card, EmptyState, Icon, Screen, Skeleton } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { dayLabel, money } from '@/lib/format';
import { supabase } from '@/lib/supabase';

export { RouteErrorBoundary as ErrorBoundary } from '@/components/ui';

type Summary = { title: string; ordered_on: string; delivery_charge: number; order_items: { qty: number; unit_price: number }[] };

export default function OrderConfirmed() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const theme = useTheme();
  const [order, setOrder] = useState<Summary | null>();

  useEffect(() => {
    supabase
      .from('orders')
      .select('title, ordered_on, delivery_charge, order_items(qty, unit_price)')
      .eq('id', id)
      .maybeSingle()
      .then(({ data }) => setOrder((data as Summary | null) ?? null));
  }, [id]);

  const backToOrders = () => router.dismissTo('/');

  if (order === null) {
    return (
      <Screen scroll={false} contentStyle={{ justifyContent: 'center' }}>
        <EmptyState icon="delete" title="This lunch was removed" text="Someone deleted it." action={{ label: 'Back to orders', onPress: backToOrders }} />
      </Screen>
    );
  }

  const count = order?.order_items.reduce((s, i) => s + i.qty, 0) ?? 0;
  const total = (order?.order_items.reduce((s, i) => s + i.qty * i.unit_price, 0) ?? 0) + (order?.delivery_charge ?? 0);

  return (
    <Screen
      scroll={false}
      contentStyle={{ justifyContent: 'center', alignItems: 'stretch' }}
      footer={
        <>
          <Button title="Back to orders" onPress={backToOrders} />
          <Button title="Pick my items" variant="ghost" onPress={() => router.replace({ pathname: '/order/[id]', params: { id } })} />
        </>
      }>
      <View style={{ alignItems: 'center', gap: Spacing.md }}>
        <Animated.View
          entering={ZoomIn.duration(400)}
          style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: theme.mint, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="check" size={44} color="primaryText" />
        </Animated.View>
        <ThemedText type="screenTitle" accessibilityRole="header">
          Order confirmed!
        </ThemedText>
        <ThemedText type="body" themeColor="textSecondary">
          Your lunch order has been saved.
        </ThemedText>
      </View>
      {order ? (
        <Card>
          <ThemedText type="sectionTitle" numberOfLines={1}>
            {order.title || 'Lunch'}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {dayLabel(order.ordered_on)} · {count} item{count === 1 ? '' : 's'} · {money(total)}
          </ThemedText>
        </Card>
      ) : (
        <Skeleton.Card />
      )}
    </Screen>
  );
}
