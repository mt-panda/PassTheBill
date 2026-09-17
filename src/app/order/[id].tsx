import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Button, ScrollView, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Card, Row, styles } from '@/components/ui';
import { money, useSession } from '@/lib/session';
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
        <ThemedText themeColor="textSecondary">This order was deleted.</ThemedText>
      </View>
    );
  }

  const open = order.status === 'open';
  const isCreator = order.created_by === me;
  const items = [...order.order_items].sort((a, b) => a.name.localeCompare(b.name));
  const names = Object.fromEntries(items.flatMap((i) => i.claims.map((c) => [c.member_id, c.members.name])));
  const unclaimed = items.reduce((s, i) => s + i.qty - i.claims.reduce((t, c) => t + c.units, 0), 0);
  const bill = items.reduce((s, i) => s + i.qty * i.unit_price, 0);

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
                    onPress={() => router.push({ pathname: '/order-form', params: { id: order.id } })}
                  />
                )
              : undefined,
        }}
      />
      <ScrollView contentContainerStyle={styles.screen}>
        <ThemedText type="small" themeColor="textSecondary">
          {order.ordered_on} · ordered by {order.creator.name} · {open ? 'open' : 'closed'}
        </ThemedText>

        {items.map((item) => {
          const claimed = item.claims.reduce((s, c) => s + c.units, 0);
          const mine = item.claims.find((c) => c.member_id === me)?.units ?? 0;
          return (
            <Card key={item.id}>
              <Row>
                <ThemedText type="smallBold">{item.name}</ThemedText>
                <ThemedText type="small">
                  {money(item.unit_price)} × {item.qty}
                </ThemedText>
              </Row>
              <ThemedText type="small" themeColor={claimed < item.qty ? 'text' : 'textSecondary'}>
                {claimed}/{item.qty} claimed
                {item.claims.length > 0 && ' · ' + item.claims.map((c) => `${c.members.name} ${c.units}`).join(', ')}
              </ThemedText>
              {open && (
                <Row>
                  <ThemedText type="small">You: {mine}</ThemedText>
                  <Row>
                    <Button title="−" disabled={busy || mine === 0} onPress={() => claim(item, -1)} />
                    <Button title="+" disabled={busy || claimed >= item.qty} onPress={() => claim(item, 1)} />
                  </Row>
                </Row>
              )}
            </Card>
          );
        })}

        <Card>
          <Row>
            <ThemedText type="small">Items</ThemedText>
            <ThemedText type="small">{money(bill)}</ThemedText>
          </Row>
          <Row>
            <ThemedText type="small">
              Delivery{shares.length > 0 && `, split ${shares.length} way${shares.length > 1 ? 's' : ''}`}
            </ThemedText>
            <ThemedText type="small">{money(order.delivery_charge)}</ThemedText>
          </Row>
          <Row>
            <ThemedText type="smallBold">Total</ThemedText>
            <ThemedText type="smallBold">{money(bill + order.delivery_charge)}</ThemedText>
          </Row>
        </Card>

        {shares.length > 0 && (
          <Card>
            <ThemedText type="smallBold">Who pays what</ThemedText>
            {shares.map((s) => (
              <Row key={s.member_id}>
                <ThemedText type={s.member_id === me ? 'smallBold' : 'small'}>{names[s.member_id]}</ThemedText>
                <ThemedText type={s.member_id === me ? 'smallBold' : 'small'}>
                  {money(s.items_total + s.delivery_share)}
                </ThemedText>
              </Row>
            ))}
          </Card>
        )}

        {open && isCreator && (
          <>
            <Button
              title={unclaimed > 0 ? `${unclaimed} unit(s) still unclaimed` : 'Close order'}
              disabled={busy || unclaimed > 0}
              onPress={close}
            />
            <Button title="Delete order" color="#d33" disabled={busy} onPress={remove} />
          </>
        )}
      </ScrollView>
    </>
  );
}
