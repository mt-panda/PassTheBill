import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Button, ScrollView } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Card, Input, Row, styles } from '@/components/ui';
import { CURRENCY, useSession, ymd } from '@/lib/session';
import { supabase } from '@/lib/supabase';

type Draft = { key: string; id?: string; name: string; price: string; qty: string };

const blank = (): Draft => ({ key: String(Math.random()), name: '', price: '', qty: '1' });

export default function OrderFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const member = useSession().member!;
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(ymd(new Date()));
  const [delivery, setDelivery] = useState('');
  const [items, setItems] = useState<Draft[]>([blank()]);
  const [originalIds, setOriginalIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!id) return;
    supabase
      .from('orders')
      .select('title, ordered_on, delivery_charge, order_items(id, name, unit_price, qty)')
      .eq('id', id)
      .single()
      .then(({ data, error }) => {
        if (error) return Alert.alert('Could not load order', error.message);
        setTitle(data.title);
        setDate(data.ordered_on);
        setDelivery(String(data.delivery_charge));
        const rows = data.order_items as { id: string; name: string; unit_price: number; qty: number }[];
        setItems(rows.map((i) => ({ key: i.id, id: i.id, name: i.name, price: String(i.unit_price), qty: String(i.qty) })));
        setOriginalIds(rows.map((i) => i.id));
      });
  }, [id]);

  const update = (key: string, patch: Partial<Draft>) =>
    setItems((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  async function save() {
    const rows = items.filter((r) => r.name.trim() || r.price.trim());
    const deliveryCharge = Number(delivery || 0);
    const bad = rows.find(
      (r) =>
        !r.name.trim() ||
        r.price.trim() === '' ||
        !(Number(r.price) >= 0) ||
        !Number.isInteger(Number(r.qty)) ||
        Number(r.qty) < 1
    );
    if (!rows.length) return Alert.alert('Add at least one item');
    if (bad) return Alert.alert('Check your items', 'Every item needs a name, a price, and a whole-number quantity.');
    if (!(deliveryCharge >= 0)) return Alert.alert('Delivery charge must be a number');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || isNaN(Date.parse(date))) return Alert.alert('Date must be YYYY-MM-DD');

    const order = { title: title.trim(), ordered_on: date, delivery_charge: deliveryCharge };
    const toRow = (r: Draft) => ({ name: r.name.trim(), unit_price: Number(r.price), qty: Number(r.qty) });

    setBusy(true);
    try {
      if (!id) {
        const { data, error } = await supabase
          .from('orders')
          .insert({ ...order, team_id: member.team_id, created_by: member.id })
          .select('id')
          .single();
        if (error) throw error;
        const { error: itemsError } = await supabase
          .from('order_items')
          .insert(rows.map((r) => ({ ...toRow(r), order_id: data.id })));
        if (itemsError) {
          await supabase.from('orders').delete().eq('id', data.id);
          throw itemsError;
        }
        router.replace({ pathname: '/order/[id]', params: { id: data.id } });
        return;
      }

      // ponytail: edit is several requests, not one transaction. A failure midway leaves a partial edit
      // the orderer can see and redo. Move to a save_order() RPC if that ever causes real confusion.
      const { data: updated, error } = await supabase.from('orders').update(order).eq('id', id).select('id');
      if (error) throw error;
      if (!updated.length) throw new Error('This order is closed and can no longer be edited.');
      for (const r of rows.filter((r) => r.id)) {
        const { error } = await supabase.from('order_items').update(toRow(r)).eq('id', r.id!);
        if (error) throw new Error(`${r.name}: ${error.message}`);
      }
      const added = rows.filter((r) => !r.id).map((r) => ({ ...toRow(r), order_id: id }));
      if (added.length) {
        const { error } = await supabase.from('order_items').insert(added);
        if (error) throw error;
      }
      const removed = originalIds.filter((oid) => !rows.some((r) => r.id === oid));
      if (removed.length) {
        const { error } = await supabase.from('order_items').delete().in('id', removed);
        if (error) throw error;
      }
      router.back();
    } catch (e) {
      Alert.alert('Could not save', (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: id ? 'Edit order' : 'New order' }} />
      <ScrollView contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
        <Input placeholder="Title (optional), e.g. KFC" value={title} onChangeText={setTitle} />
        <Row>
          <Input style={{ flex: 1 }} placeholder="YYYY-MM-DD" value={date} onChangeText={setDate} />
          <Input
            style={{ flex: 1 }}
            placeholder={`Delivery (${CURRENCY})`}
            value={delivery}
            onChangeText={setDelivery}
            keyboardType="decimal-pad"
          />
        </Row>

        <ThemedText type="smallBold">Items</ThemedText>
        {items.map((r) => (
          <Card key={r.key}>
            <Row>
              <Input style={{ flex: 1 }} placeholder="Item name" value={r.name} onChangeText={(name) => update(r.key, { name })} />
              <Button title="✕" onPress={() => setItems((rows) => rows.filter((x) => x.key !== r.key))} />
            </Row>
            <Row>
              <Input
                style={{ flex: 2 }}
                placeholder={`Price each (${CURRENCY})`}
                value={r.price}
                onChangeText={(price) => update(r.key, { price })}
                keyboardType="decimal-pad"
              />
              <Input
                style={{ flex: 1 }}
                placeholder="Qty"
                value={r.qty}
                onChangeText={(qty) => update(r.key, { qty })}
                keyboardType="number-pad"
              />
            </Row>
          </Card>
        ))}
        <Button title="+ Add item" onPress={() => setItems((rows) => [...rows, blank()])} />
        <Button title={busy ? 'Saving…' : 'Save order'} disabled={busy} onPress={save} />
      </ScrollView>
    </>
  );
}
