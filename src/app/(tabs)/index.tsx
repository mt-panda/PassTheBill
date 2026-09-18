import { Link } from 'expo-router';
import { useState } from 'react';
import { Alert, FlatList, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Badge, Card, EmptyState, Icon, Row, styles } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { money, niceDate, useSession } from '@/lib/session';
import { supabase, useLive } from '@/lib/supabase';

type OrderRow = {
  id: string;
  title: string;
  ordered_on: string;
  status: 'open' | 'closed';
  delivery_charge: number;
  created_by: string;
  creator: { name: string };
  extra_charges: { status: 'pending' | 'accepted' | 'rejected'; member_id: string }[];
  order_items: { qty: number; unit_price: number; claims: { units: number; member_id: string }[] }[];
};

export default function OrdersScreen() {
  const { member } = useSession();
  const me = member!.id;
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [orders, setOrders] = useState<OrderRow[]>([]);

  useLive('orders,order_items,claims,extra_charges', async () => {
    const { data, error } = await supabase
      .from('orders')
      .select(
        'id, title, ordered_on, status, delivery_charge, created_by, creator:members!orders_created_by_fkey(name), extra_charges(status, member_id), order_items(qty, unit_price, claims(units, member_id))'
      )
      .order('ordered_on', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) return Alert.alert('Could not load orders', error.message);
    setOrders(data as unknown as OrderRow[]);
  });

  const team = member!.teams;

  return (
    <FlatList
      data={orders}
      keyExtractor={(o) => o.id}
      contentContainerStyle={[styles.screen, { paddingTop: insets.top + 16 }]}
      ListHeaderComponent={
        <View style={{ gap: 16 }}>
          <View style={{ flexShrink: 1, gap: 4, marginBottom: 4 }}>
              <ThemedText type="small" themeColor="textSecondary">
                Hi {member!.name.split(' ')[0]}
              </ThemedText>
              <ThemedText type="subtitle" numberOfLines={1}>
                {team.name}
              </ThemedText>
          </View>
          {orders.length > 0 && (
            <Row style={styles.section}>
              <ThemedText type="label" themeColor="textSecondary">
                Orders
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 13 }}>
                Tap one to claim your food
              </ThemedText>
            </Row>
          )}
        </View>
      }
      ListEmptyComponent={
        <EmptyState
          icon="food"
          title="No orders yet"
          text="Tap the + button below to add what was ordered. Your team can then claim their items."
        />
      }
      renderItem={({ item: o }) => {
        const units = o.order_items.flatMap((i) => i.claims);
        const qty = o.order_items.reduce((s, i) => s + i.qty, 0);
        const claimed = units.reduce((s, c) => s + c.units, 0);
        const mine = units.filter((c) => c.member_id === me).reduce((s, c) => s + c.units, 0);
        const total = o.order_items.reduce((s, i) => s + i.qty * i.unit_price, 0) + o.delivery_charge;
        const myPending = o.extra_charges.some((c) => c.member_id === me && c.status === 'pending');
        const unresolved = o.extra_charges.some((c) => c.status !== 'accepted');
        const badge =
          o.status === 'closed' ? (
            <Badge icon="lock">Closed</Badge>
          ) : myPending ? (
            <Badge tone="warning" icon="bell">
              Charge needs your answer
            </Badge>
          ) : qty > claimed ? (
            <Badge tone="warning">{`${qty - claimed} left to claim`}</Badge>
          ) : unresolved ? (
            <Badge tone="warning">Extra charge pending</Badge>
          ) : (
            <Badge tone="success" icon="check">
              Ready to close
            </Badge>
          );
        return (
          <Link href={{ pathname: '/order/[id]', params: { id: o.id } }} asChild>
            <Pressable style={({ pressed }) => pressed && { opacity: 0.7, transform: [{ scale: 0.99 }] }}>
              <Card style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 14,
                    backgroundColor: theme.backgroundSelected,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                  <Icon name="food" size={20} />
                </View>
                <View style={{ flex: 1, gap: 6 }}>
                  <Row>
                    <ThemedText type="smallBold" numberOfLines={1} style={{ flexShrink: 1 }}>
                      {o.title || 'Lunch'}
                    </ThemedText>
                    <ThemedText type="smallBold" style={{ flexShrink: 0, fontVariant: ['tabular-nums'] }}>
                      {money(total)}
                    </ThemedText>
                  </Row>
                  <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                    {niceDate(o.ordered_on)} · by {o.created_by === me ? 'you' : o.creator.name}
                  </ThemedText>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                    {badge}
                    {mine > 0 && (
                      <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 13 }}>
                        You claimed {mine}
                      </ThemedText>
                    )}
                  </View>
                </View>
                <Icon name="forward" size={14} color="textSecondary" />
              </Card>
            </Pressable>
          </Link>
        );
      }}
    />
  );
}
