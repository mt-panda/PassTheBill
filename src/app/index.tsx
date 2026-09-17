import { Link, router } from 'expo-router';
import { useState } from 'react';
import { Alert, FlatList, Pressable, Share, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Avatar, Badge, Button, Card, EmptyState, Icon, Row, styles } from '@/components/ui';
import { Fonts } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { money, niceDate, useSession } from '@/lib/session';
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
  const theme = useTheme();
  const insets = useSafeAreaInsets();
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
  const share = () => Share.share({ message: `Join "${team.name}" on PassTheBill with code ${team.code}` });

  return (
    <>
      <FlatList
        data={orders}
        keyExtractor={(o) => o.id}
        contentContainerStyle={[styles.screen, { paddingTop: insets.top + 16, paddingBottom: 120 + insets.bottom }]}
        ListHeaderComponent={
          <View style={{ gap: 16 }}>
            <Row style={{ alignItems: 'flex-start', marginBottom: 4 }}>
              <View style={{ flexShrink: 1, gap: 4 }}>
                <ThemedText type="small" themeColor="textSecondary">
                  Hi {member!.name.split(' ')[0]}
                </ThemedText>
                <ThemedText type="subtitle" numberOfLines={1}>
                  {team.name}
                </ThemedText>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Settings"
                hitSlop={8}
                style={({ pressed }) => pressed && { opacity: 0.7 }}
                onPress={() => router.push('/settings')}>
                <Avatar name={member!.name} size={44} />
              </Pressable>
            </Row>
            <Card>
              <Row>
                <View style={{ gap: 4, flexShrink: 1 }}>
                  <ThemedText type="label" themeColor="textSecondary">
                    Invite your team
                  </ThemedText>
                  <ThemedText
                    selectable
                    style={{ fontFamily: Fonts.mono, fontSize: 24, lineHeight: 30, fontWeight: '700', letterSpacing: 3 }}>
                    {team.code}
                  </ThemedText>
                </View>
                <Button title="Share" icon="share" variant="secondary" small onPress={share} />
              </Row>
              <ThemedText type="small" themeColor="textSecondary">
                Teammates enter this code to join and claim their food.
              </ThemedText>
            </Card>
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
            text="Tap “New order” below to add what was ordered. Your team can then claim their items."
          />
        }
        renderItem={({ item: o }) => {
          const units = o.order_items.flatMap((i) => i.claims);
          const qty = o.order_items.reduce((s, i) => s + i.qty, 0);
          const claimed = units.reduce((s, c) => s + c.units, 0);
          const mine = units.filter((c) => c.member_id === member!.id).reduce((s, c) => s + c.units, 0);
          const total = o.order_items.reduce((s, i) => s + i.qty * i.unit_price, 0) + o.delivery_charge;
          const badge =
            o.status === 'closed' ? (
              <Badge icon="lock">Closed</Badge>
            ) : qty > claimed ? (
              <Badge tone="warning">{`${qty - claimed} left to claim`}</Badge>
            ) : (
              <Badge tone="success" icon="check">
                Ready to close
              </Badge>
            );
          return (
            <Link href={{ pathname: '/order/[id]', params: { id: o.id } }} asChild>
              <Pressable style={({ pressed }) => pressed && { opacity: 0.7 }}>
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
                      <ThemedText type="smallBold" style={{ fontVariant: ['tabular-nums'] }}>
                        {money(total)}
                      </ThemedText>
                    </Row>
                    <Row>
                      <ThemedText type="small" themeColor="textSecondary">
                        {niceDate(o.ordered_on)}
                        {mine > 0 && ` · You claimed ${mine}`}
                      </ThemedText>
                      {badge}
                    </Row>
                  </View>
                  <Icon name="forward" size={14} color="textSecondary" />
                </Card>
              </Pressable>
            </Link>
          );
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          paddingHorizontal: 20,
          paddingTop: 12,
          paddingBottom: insets.bottom + 12,
          backgroundColor: theme.background,
          borderTopWidth: 1,
          borderTopColor: theme.border,
        }}>
        <Row style={{ width: '100%', maxWidth: 760, alignSelf: 'center' }}>
          <Button
            title="Monthly totals"
            icon="chart"
            variant="secondary"
            onPress={() => router.push('/totals')}
            style={{ flex: 1, paddingHorizontal: 12 }}
          />
          <Button title="New order" icon="add" onPress={() => router.push('/order-form')} style={{ flex: 1 }} />
        </Row>
      </View>
    </>
  );
}
