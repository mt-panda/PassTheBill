import { useState } from 'react';
import { Alert, Button, ScrollView } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Card, Row, styles } from '@/components/ui';
import { money, useSession, ymd } from '@/lib/session';
import { supabase, useLive } from '@/lib/supabase';

type Total = {
  member_id: string;
  member_name: string;
  items_total: number;
  delivery_total: number;
  grand_total: number;
  settled_at: string | null;
};

export default function TotalsScreen() {
  const member = useSession().member!;
  const [cursor, setCursor] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [totals, setTotals] = useState<Total[]>([]);
  const [openOrders, setOpenOrders] = useState(0);
  const [busy, setBusy] = useState(false);

  const month = ymd(cursor);
  const nextMonth = ymd(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1));

  async function load() {
    const [t, o] = await Promise.all([
      supabase.from('member_month_totals').select('*').eq('month', month).order('member_name'),
      supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'open')
        .gte('ordered_on', month)
        .lt('ordered_on', nextMonth),
    ]);
    const error = t.error ?? o.error;
    if (error) return Alert.alert('Could not load totals', error.message);
    setTotals(t.data as Total[]);
    setOpenOrders(o.count ?? 0);
  }

  useLive('orders,order_items,claims,settlements', load, month);

  async function toggle(t: Total) {
    setBusy(true);
    const { error } = t.settled_at
      ? await supabase.from('settlements').delete().eq('member_id', t.member_id).eq('month', month)
      : await supabase.from('settlements').insert({ member_id: t.member_id, month, team_id: member.team_id });
    if (error) Alert.alert('Could not update', error.message);
    await load();
    setBusy(false);
  }

  const shift = (by: number) => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + by, 1));
  const label = cursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <Row>
        <Button title="‹ Prev" onPress={() => shift(-1)} />
        <ThemedText type="smallBold">{label}</ThemedText>
        <Button title="Next ›" onPress={() => shift(1)} />
      </Row>

      {openOrders > 0 && (
        <ThemedText type="small" themeColor="textSecondary">
          {openOrders} order(s) this month still open. Totals may change, and settling is disabled until they're closed.
        </ThemedText>
      )}
      {totals.length === 0 && <ThemedText themeColor="textSecondary">Nothing ordered this month.</ThemedText>}

      {totals.map((t) => (
        <Card key={t.member_id}>
          <Row>
            <ThemedText type="smallBold">{t.member_name}</ThemedText>
            <ThemedText type="smallBold">{money(t.grand_total)}</ThemedText>
          </Row>
          <ThemedText type="small" themeColor="textSecondary">
            Items {money(t.items_total)} + delivery {money(t.delivery_total)}
          </ThemedText>
          <Row>
            <ThemedText type="small" themeColor={t.settled_at ? 'textSecondary' : 'text'}>
              {t.settled_at ? `Settled ${t.settled_at.slice(0, 10)}` : 'Not settled'}
            </ThemedText>
            <Button
              title={t.settled_at ? 'Undo' : 'Mark settled'}
              disabled={busy || (!t.settled_at && openOrders > 0)}
              onPress={() => toggle(t)}
            />
          </Row>
        </Card>
      ))}

      {totals.length > 0 && (
        <Card>
          <Row>
            <ThemedText type="smallBold">Team total</ThemedText>
            <ThemedText type="smallBold">{money(totals.reduce((s, t) => s + t.grand_total, 0))}</ThemedText>
          </Row>
        </Card>
      )}
    </ScrollView>
  );
}
