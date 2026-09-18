import { useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Avatar, Badge, Button, Card, EmptyState, Icon, IconButton, Row, styles } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { money, niceDate, useSession, ymd } from '@/lib/session';
import { supabase, useLive } from '@/lib/supabase';

type Total = {
  member_id: string;
  member_name: string;
  items_total: number;
  delivery_total: number;
  extras_total: number;
  grand_total: number;
  settled_at: string | null;
};

export default function TotalsScreen() {
  const member = useSession().member!;
  const theme = useTheme();
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

  useLive('orders,order_items,claims,settlements,extra_charges,delivery_exclusions', load, month);

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
  const teamTotal = totals.reduce((s, t) => s + t.grand_total, 0);
  const paid = totals.filter((t) => t.settled_at).length;

  return (
    <ScrollView contentContainerStyle={styles.screen} contentInsetAdjustmentBehavior="automatic">
      <Row>
        <IconButton icon="back" label="Previous month" onPress={() => shift(-1)} />
        <ThemedText type="smallBold" style={{ fontSize: 17 }}>
          {label}
        </ThemedText>
        <IconButton icon="forward" label="Next month" onPress={() => shift(1)} />
      </Row>

      {totals.length === 0 ? (
        <EmptyState icon="money" title="Nothing this month" text="Orders placed in this month will add up here." />
      ) : (
        <>
          <Card style={{ gap: 6 }}>
            <ThemedText type="label" themeColor="textSecondary">
              Team spent
            </ThemedText>
            <ThemedText type="title">{money(teamTotal)}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {paid} of {totals.length} {totals.length > 1 ? 'people have' : 'person has'} paid
            </ThemedText>
          </Card>

          {openOrders > 0 && (
            <Card style={{ backgroundColor: theme.warningSoft, borderColor: theme.warningSoft, flexDirection: 'row' }}>
              <Icon name="info" size={20} color="warning" />
              <ThemedText type="small" themeColor="warning" style={{ flex: 1 }}>
                {openOrders} order{openOrders > 1 ? 's are' : ' is'} still open, so these numbers may change. Close
                {openOrders > 1 ? ' them' : ' it'} before marking anyone as paid.
              </ThemedText>
            </Card>
          )}

          <ThemedText type="label" themeColor="textSecondary" style={styles.section}>
            Who owes what
          </ThemedText>
          {totals.map((t) => (
            <Card key={t.member_id}>
              <Row>
                <Row style={{ flexShrink: 1 }}>
                  <Avatar name={t.member_name} size={40} />
                  <View style={{ flexShrink: 1, gap: 2 }}>
                    <ThemedText type="smallBold" numberOfLines={1}>
                      {t.member_id === member.id ? `${t.member_name} (you)` : t.member_name}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 13 }}>
                      {money(t.items_total)} food + {money(t.delivery_total)} delivery
                      {t.extras_total > 0 && ` + ${money(t.extras_total)} extra`}
                    </ThemedText>
                  </View>
                </Row>
                <ThemedText type="smallBold" style={{ fontSize: 17, fontVariant: ['tabular-nums'] }}>
                  {money(t.grand_total)}
                </ThemedText>
              </Row>
              <Row>
                {t.settled_at ? (
                  <Badge tone="success" icon="check">{`Paid · ${niceDate(t.settled_at)}`}</Badge>
                ) : (
                  <Badge tone="warning">Not paid yet</Badge>
                )}
                <Button
                  small
                  title={t.settled_at ? 'Undo' : 'Mark as paid'}
                  icon={t.settled_at ? undefined : 'check'}
                  variant={t.settled_at ? 'ghost' : 'secondary'}
                  disabled={busy || (!t.settled_at && openOrders > 0)}
                  onPress={() => toggle(t)}
                />
              </Row>
            </Card>
          ))}
        </>
      )}
    </ScrollView>
  );
}
