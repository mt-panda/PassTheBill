import { Link, Stack, router } from 'expo-router';
import { useState } from 'react';
import { Alert, Button, FlatList, Pressable, Share } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Card, Row, styles } from '@/components/ui';
import { money, useSession } from '@/lib/session';
import { supabase, useLive } from '@/lib/supabase';

type OrderRow = {
  id: string;
  title: string;
  ordered_on: string;
  status: 'open' | 'closed';
  delivery_charge: number;
  order_items: { qty: number; unit_price: number; claims: { units: number; member_id: string }[] }[];
};

export default function OrdersScreen() {
  const { member } = useSession();
  const [orders, setOrders] = useState<OrderRow[]>([]);

  useLive('orders,order_items,claims', async () => {
    // ponytail: last 100 orders only, add paging if anyone scrolls that far back
    const { data, error } = await supabase
      .from('orders')
      .select('id, title, ordered_on, status, delivery_charge, order_items(qty, unit_price, claims(units, member_id))')
      .order('ordered_on', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) return Alert.alert('Could not load orders', error.message);
    setOrders(data as OrderRow[]);
  });

  const team = member!.teams;

  return (
    <>
      <Stack.Screen
        options={{
          title: team.name,
          headerRight: () => <Button title="Totals" onPress={() => router.push('/totals')} />,
        }}
      />
      <FlatList
        data={orders}
        keyExtractor={(o) => o.id}
        contentContainerStyle={styles.screen}
        ListHeaderComponent={
          <Row>
            <Pressable
              onPress={() =>
                Share.share({ message: `Join "${team.name}" on Pass The Bill with code ${team.code}` })
              }>
              <ThemedText type="small" themeColor="textSecondary">
                Team code <ThemedText type="code">{team.code}</ThemedText> · tap to share
              </ThemedText>
            </Pressable>
            <Button title="New order" onPress={() => router.push('/order-form')} />
          </Row>
        }
        ListEmptyComponent={<ThemedText themeColor="textSecondary">No orders yet.</ThemedText>}
        renderItem={({ item: o }) => {
          const units = o.order_items.flatMap((i) => i.claims);
          const qty = o.order_items.reduce((s, i) => s + i.qty, 0);
          const claimed = units.reduce((s, c) => s + c.units, 0);
          const mine = units.filter((c) => c.member_id === member!.id).reduce((s, c) => s + c.units, 0);
          const total = o.order_items.reduce((s, i) => s + i.qty * i.unit_price, 0) + o.delivery_charge;
          const status =
            o.status === 'closed'
              ? 'Closed'
              : qty > claimed
                ? `${qty - claimed} unclaimed${mine ? '' : ' · tap to claim'}`
                : 'All claimed · ready to close';
          return (
            <Link href={{ pathname: '/order/[id]', params: { id: o.id } }} asChild>
              <Pressable>
                <Card>
                  <Row>
                    <ThemedText type="smallBold">{o.title || 'Lunch'}</ThemedText>
                    <ThemedText type="smallBold">{money(total)}</ThemedText>
                  </Row>
                  <Row>
                    <ThemedText type="small" themeColor="textSecondary">
                      {o.ordered_on}
                    </ThemedText>
                    <ThemedText type="small" themeColor={o.status === 'open' ? 'text' : 'textSecondary'}>
                      {status}
                    </ThemedText>
                  </Row>
                </Card>
              </Pressable>
            </Link>
          );
        }}
      />
    </>
  );
}
