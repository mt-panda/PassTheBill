import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Avatar, Badge, Button, Card, Divider, EmptyState, IconButton, Row, styles } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { money, niceDate, useSession } from '@/lib/session';
import { supabase, useLive } from '@/lib/supabase';

type Claim = { id: string; member_id: string; units: number; members: { name: string } };
type Item = { id: string; name: string; unit_price: number; qty: number; claims: Claim[] };
type Order = {
  id: string;
  title: string;
  ordered_on: string;
  delivery_charge: number;
  status: 'open' | 'closed';
  created_by: string;
  creator: { name: string };
  order_items: Item[];
};
type Share = { member_id: string; items_total: number; delivery_share: number };

export default function OrderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const me = useSession().member!.id;
  const theme = useTheme();
  const [order, setOrder] = useState<Order | null>(); // undefined = loading, null = gone
  const [shares, setShares] = useState<Share[]>([]);
  const [busy, setBusy] = useState(false);

  async function load() {
    const [o, s] = await Promise.all([
      supabase
        .from('orders')
        .select('*, creator:members(name), order_items(id, name, unit_price, qty, claims(id, member_id, units, members(name)))')
        .eq('id', id)
        .maybeSingle(),
      supabase.from('order_member_totals').select('member_id, items_total, delivery_share').eq('order_id', id),
    ]);
    const error = o.error ?? s.error;
    if (error) return Alert.alert('Could not load order', error.message);
    setOrder(o.data as Order | null);
    setShares(s.data as Share[]);
  }

  useLive('orders,order_items,claims', load);

  async function run(action: () => PromiseLike<{ error: { message: string } | null }>) {
    setBusy(true);
    const { error } = await action();
    if (error) Alert.alert('Could not update', error.message);
    await load();
    setBusy(false);
  }

  if (order === undefined) return null;
  if (order === null) {
    return (
      <View style={styles.center}>
        <EmptyState icon="delete" title="Order deleted" text="Someone removed this order. Go back to see the rest." />
      </View>
    );
  }

  const open = order.status === 'open';
  const isCreator = order.created_by === me;
  const items = [...order.order_items].sort((a, b) => a.name.localeCompare(b.name));
  const names = Object.fromEntries(items.flatMap((i) => i.claims.map((c) => [c.member_id, c.members.name])));
  const unclaimed = items.reduce((s, i) => s + i.qty - i.claims.reduce((t, c) => t + c.units, 0), 0);
  const totalUnits = items.reduce((s, i) => s + i.qty, 0);
  const bill = items.reduce((s, i) => s + i.qty * i.unit_price, 0);
  const myShare = shares.find((s) => s.member_id === me);

  function claim(item: Item, delta: 1 | -1) {
    const mine = item.claims.find((c) => c.member_id === me);
    const units = (mine?.units ?? 0) + delta;
    run(() =>
      !mine
        ? supabase.from('claims').insert({ item_id: item.id, member_id: me, units })
        : units === 0
          ? supabase.from('claims').delete().eq('id', mine.id)
          : supabase.from('claims').update({ units }).eq('id', mine.id)
    );
  }

  function close() {
    Alert.alert('Close order?', 'Claims and prices are frozen after closing.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Close', onPress: () => run(() => supabase.rpc('close_order', { p_order_id: order!.id })) },
    ]);
  }

  function remove() {
    Alert.alert('Delete order?', 'All items and claims on it are removed.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('orders').delete().eq('id', order!.id);
          if (error) return Alert.alert('Could not delete', error.message);
          router.back();
        },
      },
    ]);
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: order.title || 'Lunch',
          headerRight:
            open && isCreator
              ? () => (
                  <Button
                    title="Edit"
                    icon="edit"
                    variant="secondary"
                    small
                    onPress={() => router.push({ pathname: '/order-form', params: { id: order.id } })}
                  />
                )
              : undefined,
        }}
      />
      <ScrollView contentContainerStyle={styles.screen} contentInsetAdjustmentBehavior="automatic">
        <Card style={{ gap: 10 }}>
          <Row>
            <ThemedText type="label" themeColor="textSecondary">
              Total bill
            </ThemedText>
            {open ? (
              <Badge tone={unclaimed > 0 ? 'warning' : 'success'}>Open</Badge>
            ) : (
              <Badge icon="lock">Closed</Badge>
            )}
          </Row>
          <ThemedText type="title">{money(bill + order.delivery_charge)}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {niceDate(order.ordered_on)} · Ordered by {order.creator.name}
          </ThemedText>
          <View style={{ height: 6, borderRadius: 3, backgroundColor: theme.backgroundSelected, marginTop: 6 }}>
            <View
              style={{
                height: 6,
                borderRadius: 3,
                width: `${totalUnits ? ((totalUnits - unclaimed) / totalUnits) * 100 : 0}%`,
                backgroundColor: unclaimed > 0 ? theme.primary : theme.success,
              }}
            />
          </View>
          <ThemedText type="small" themeColor="textSecondary">
            {totalUnits - unclaimed} of {totalUnits} claimed
          </ThemedText>
        </Card>

        {myShare && (
          <Card style={{ backgroundColor: theme.primary, borderColor: theme.primary }}>
            <Row>
              <View style={{ gap: 2 }}>
                <ThemedText type="label" themeColor="onPrimary" style={{ opacity: 0.7 }}>
                  You pay
                </ThemedText>
                <ThemedText type="subtitle" themeColor="onPrimary" style={{ fontVariant: ['tabular-nums'] }}>
                  {money(myShare.items_total + myShare.delivery_share)}
                </ThemedText>
              </View>
              <ThemedText type="small" themeColor="onPrimary" style={{ opacity: 0.7, textAlign: 'right' }}>
                {money(myShare.items_total)} food{'\n'}+ {money(myShare.delivery_share)} delivery
              </ThemedText>
            </Row>
          </Card>
        )}

        {open && (
          <ThemedText type="small" themeColor="textSecondary" style={{ paddingHorizontal: 4 }}>
            Tap + on everything you ate. Tap − if you made a mistake.
          </ThemedText>
        )}

        <ThemedText type="label" themeColor="textSecondary" style={styles.section}>
          Items
        </ThemedText>
        {items.map((item) => {
          const claimed = item.claims.reduce((s, c) => s + c.units, 0);
          const mine = item.claims.find((c) => c.member_id === me)?.units ?? 0;
          const left = item.qty - claimed;
          return (
            <Card key={item.id} style={mine > 0 && { borderColor: theme.primary, borderWidth: 1.5 }}>
              <Row style={{ alignItems: 'flex-start' }}>
                <View style={{ flex: 1, gap: 4 }}>
                  <ThemedText type="smallBold">{item.name}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {money(item.unit_price)} each · {item.qty} ordered
                  </ThemedText>
                </View>
                {left > 0 ? (
                  <Badge tone="warning">{`${left} left`}</Badge>
                ) : (
                  <Badge tone="success" icon="check">
                    All claimed
                  </Badge>
                )}
              </Row>

              {item.claims.length > 0 && (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {item.claims.map((c) => (
                    <Badge key={c.id}>{`${c.member_id === me ? 'You' : c.members.name} × ${c.units}`}</Badge>
                  ))}
                </View>
              )}

              {open && (
                <>
                  <Divider />
                  <Row>
                    <ThemedText type="small" themeColor={mine ? 'text' : 'textSecondary'}>
                      {mine ? `You had ${mine}` : 'Did you have this?'}
                    </ThemedText>
                    <Row>
                      <IconButton
                        icon="remove"
                        label={`Unclaim one ${item.name}`}
                        disabled={busy || mine === 0}
                        onPress={() => claim(item, -1)}
                      />
                      <ThemedText
                        type="smallBold"
                        style={{ minWidth: 20, textAlign: 'center', fontVariant: ['tabular-nums'] }}>
                        {mine}
                      </ThemedText>
                      <IconButton
                        icon="add"
                        label={`Claim one ${item.name}`}
                        primary
                        disabled={busy || left <= 0}
                        onPress={() => claim(item, 1)}
                      />
                    </Row>
                  </Row>
                </>
              )}
            </Card>
          );
        })}

        <ThemedText type="label" themeColor="textSecondary" style={styles.section}>
          Bill
        </ThemedText>
        <Card>
          <Row>
            <ThemedText type="small" themeColor="textSecondary">
              Food
            </ThemedText>
            <ThemedText type="small">{money(bill)}</ThemedText>
          </Row>
          <Row>
            <ThemedText type="small" themeColor="textSecondary">
              Delivery
              {shares.length > 0 && `, split between ${shares.length} ${shares.length > 1 ? 'people' : 'person'}`}
            </ThemedText>
            <ThemedText type="small">{money(order.delivery_charge)}</ThemedText>
          </Row>
          <Divider />
          <Row>
            <ThemedText type="smallBold">Total</ThemedText>
            <ThemedText type="smallBold">{money(bill + order.delivery_charge)}</ThemedText>
          </Row>
        </Card>

        {shares.length > 0 && (
          <>
            <ThemedText type="label" themeColor="textSecondary" style={styles.section}>
              Who pays what
            </ThemedText>
            <Card>
              {shares.map((s, i) => (
                <View key={s.member_id} style={{ gap: 14 }}>
                  {i > 0 && <Divider />}
                  <Row>
                    <Row style={{ flexShrink: 1 }}>
                      <Avatar name={names[s.member_id] ?? '?'} />
                      <ThemedText type={s.member_id === me ? 'smallBold' : 'default'} numberOfLines={1}>
                        {s.member_id === me ? 'You' : names[s.member_id]}
                      </ThemedText>
                    </Row>
                    <ThemedText type="smallBold" style={{ fontVariant: ['tabular-nums'] }}>
                      {money(s.items_total + s.delivery_share)}
                    </ThemedText>
                  </Row>
                </View>
              ))}
            </Card>
          </>
        )}

        {open && isCreator && (
          <View style={{ gap: 10, marginTop: 8 }}>
            <Button title="Close order" icon="lock" disabled={busy || unclaimed > 0} onPress={close} />
            <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center' }}>
              {unclaimed > 0
                ? `${unclaimed} still unclaimed. Everything needs an owner before you can close.`
                : 'Everything is claimed. Closing locks the order so totals stay final.'}
            </ThemedText>
            <Button title="Delete order" icon="delete" variant="danger" disabled={busy} onPress={remove} />
          </View>
        )}
      </ScrollView>
    </>
  );
}
