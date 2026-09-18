import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Avatar, Badge, Button, Card, EmptyState, Icon, Row, styles } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { money, niceDate, useSession } from '@/lib/session';
import { supabase, useLive } from '@/lib/supabase';
type Cycle = {
  id: string;
  triggered_by: string;
  status: 'open' | 'closed';
  created_at: string;
  closed_at: string | null;
};

type Total = {
  cycle_id: string;
  member_id: string;
  member_name: string;
  items_total: number;
  delivery_total: number;
  extras_total: number;
  grand_total: number;
  confirmed_at: string | null;
};

type PreviewRow = {
  order_id: string;
  member_id: string;
  items_total: number;
  delivery_share: number;
  extras_total: number;
};

type Member = {
  id: string;
  name: string;
};

export default function TotalsScreen() {
  const member = useSession().member!;
  const theme = useTheme();
  const [cycle, setCycle] = useState<Cycle | null>(null);
  const [totals, setTotals] = useState<Total[]>([]);
  const [previewTotals, setPreviewTotals] = useState<Total[]>([]);
  const [history, setHistory] = useState<Cycle[]>([]);
  const [historyTotals, setHistoryTotals] = useState<Total[]>([]);
  const [historyOrderCounts, setHistoryOrderCounts] = useState<Record<string, number>>({});
  const [expandedHistory, setExpandedHistory] = useState<string | null>(null);
  const [openOrders, setOpenOrders] = useState(0);
  const [closedWaiting, setClosedWaiting] = useState(0);
  const [busy, setBusy] = useState(false);

  async function load() {
    const [c, open, waiting, cycles, cycleTotals, cycleOrders, members] = await Promise.all([
      supabase
        .from('billing_cycles')
        .select('id, triggered_by, status, created_at, closed_at')
        .eq('status', 'open')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'open'),
      supabase.from('untallied_closed_orders').select('id'),
      supabase
        .from('billing_cycles')
        .select('id, triggered_by, status, created_at, closed_at')
        .eq('status', 'closed')
        .order('closed_at', { ascending: false })
        .limit(20),
      supabase.from('billing_cycle_member_totals').select('*'),
      supabase.from('billing_cycle_orders').select('cycle_id, order_id'),
      supabase.from('members').select('id, name'),
    ]);

    const error = c.error ?? open.error ?? waiting.error ?? cycles.error ?? cycleTotals.error ?? cycleOrders.error ?? members.error;
    if (error) return Alert.alert('Could not load tally', error.message);

    const activeCycle = (c.data as Cycle | null) ?? null;
    const waitingOrders = (waiting.data ?? []) as { id: string }[];
    const allCycleTotals = (cycleTotals.data ?? []) as Total[];
    const closedCycles = (cycles.data ?? []) as Cycle[];
    const allCycleOrders = (cycleOrders.data ?? []) as { cycle_id: string; order_id: string }[];
    const teamMembers = (members.data ?? []) as Member[];

    setCycle(activeCycle);
    setOpenOrders(open.count ?? 0);
    setClosedWaiting(waitingOrders.length);
    setTotals(activeCycle ? allCycleTotals.filter((t) => t.cycle_id === activeCycle.id) : []);
    setHistory(closedCycles);
    setHistoryTotals(allCycleTotals.filter((t) => t.cycle_id !== activeCycle?.id));

    const orderCounts: Record<string, number> = {};
    for (const row of allCycleOrders) {
      orderCounts[row.cycle_id] = (orderCounts[row.cycle_id] ?? 0) + 1;
    }
    setHistoryOrderCounts(orderCounts);

    if (waitingOrders.length === 0 || activeCycle) {
      setPreviewTotals([]);
      return;
    }

    const preview = await supabase
      .from('order_member_totals')
      .select('order_id, member_id, items_total, delivery_share, extras_total')
      .in('order_id', waitingOrders.map((o) => o.id));

    if (preview.error) return Alert.alert('Could not load current totals', preview.error.message);

    const memberMap = new Map(teamMembers.map((m) => [m.id, m.name]));
    const grouped = new Map<string, Total>();
    for (const row of (preview.data ?? []) as PreviewRow[]) {
      const existing = grouped.get(row.member_id);
      const items = Number(row.items_total ?? 0);
      const delivery = Number(row.delivery_share ?? 0);
      const extras = Number(row.extras_total ?? 0);
      if (existing) {
        existing.items_total += items;
        existing.delivery_total += delivery;
        existing.extras_total += extras;
        existing.grand_total += items + delivery + extras;
      } else {
        grouped.set(row.member_id, {
          cycle_id: 'preview',
          member_id: row.member_id,
          member_name: memberMap.get(row.member_id) ?? 'Unknown member',
          items_total: items,
          delivery_total: delivery,
          extras_total: extras,
          grand_total: items + delivery + extras,
          confirmed_at: null,
        });
      }
    }
    setPreviewTotals([...grouped.values()].sort((a, b) => a.member_name.localeCompare(b.member_name)));
  }

  useLive('orders,order_items,claims,extra_charges,delivery_exclusions,billing_cycles,billing_cycle_orders,billing_cycle_confirmations', load);

  async function run(fn: () => PromiseLike<{ error: Error | null }>) {
    setBusy(true);
    const { error } = await fn();
    if (error) Alert.alert('Could not update tally', error.message);
    await load();
    setBusy(false);
  }
  const trigger = () => run(() => supabase.rpc('trigger_billing_cycle'));
  const confirm = () => cycle && run(() => supabase.rpc('confirm_billing_cycle', { p_cycle_id: cycle.id }));
  const close = () => {
    if (!cycle) return;
    const skip = () => run(() => supabase.rpc('close_billing_cycle', { p_cycle_id: cycle.id }));
    if (openOrders === 0) return skip();
    Alert.alert(
      'Unclosed orders',
      `${openOrders} order${openOrders > 1 ? 's are' : ' is'} still open. Continue takes you to Orders. Skip closes this cycle and leaves open orders for the next tally.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Continue', onPress: () => router.navigate('/') },
        { text: 'Skip', style: 'destructive', onPress: skip },
      ]
    );
  };

  const currentTotals = cycle ? totals : previewTotals;
  const teamTotal = currentTotals.reduce((s, t) => s + Number(t.grand_total), 0);
  const confirmed = totals.filter((t) => t.confirmed_at).length;
  const mine = totals.find((t) => t.member_id === member.id);
  const isStarter = cycle?.triggered_by === member.id;
  const everyoneConfirmed = totals.length > 0 && confirmed === totals.length;
  const canClose = !!cycle && cycle.status === 'open' && isStarter && everyoneConfirmed;

  const renderTotals = (items: Total[], showConfirmation = false) => (
    <>
      {items.map((t) => (
        <Card key={`${t.cycle_id}-${t.member_id}`}>
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
          {showConfirmation && (
            t.confirmed_at ? (
              <Badge tone="success" icon="check">{`Confirmed ${niceDate(t.confirmed_at)}`}</Badge>
            ) : (
              <Badge tone="warning">Waiting</Badge>
            )
          )}
        </Card>
      ))}
    </>
  );

  return (
    <ScrollView contentContainerStyle={styles.screen} contentInsetAdjustmentBehavior="automatic">
      <Card style={{ gap: 6 }}>
        <Row>
          <ThemedText type="label" themeColor="textSecondary">
            {cycle ? 'Current tally' : closedWaiting > 0 ? 'Current totals' : 'Current tally'}
          </ThemedText>
          {cycle && <Badge tone="warning" icon="bell">Confirming</Badge>}
          {!cycle && closedWaiting > 0 && <Badge tone="warning">Ready to tally</Badge>}
        </Row>
        <ThemedText type="title">{money(teamTotal)}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {cycle
            ? `Started ${niceDate(cycle.created_at)}. ${confirmed} of ${totals.length} confirmed.`
            : closedWaiting > 0
              ? `Based on ${closedWaiting} closed order${closedWaiting > 1 ? 's' : ''} waiting to be tallied.`
              : 'No closed orders are waiting to be tallied.'}
        </ThemedText>
      </Card>

      {!cycle && closedWaiting > 0 && (
        <Button title={`Start tally (${closedWaiting} order${closedWaiting > 1 ? 's' : ''})`} icon="bell" onPress={trigger} disabled={busy} />
      )}

      {cycle && openOrders > 0 && (
        <Card style={{ backgroundColor: theme.warningSoft, borderColor: theme.warningSoft, flexDirection: 'row' }}>
          <Icon name="info" size={20} color="warning" />
          <ThemedText type="small" themeColor="warning" style={{ flex: 1 }}>
            {openOrders} open order{openOrders > 1 ? 's are' : ' is'} not in this tally. Closing skips them into the next cycle.
          </ThemedText>
        </Card>
      )}

      {currentTotals.length > 0 && (
        <>
          <ThemedText type="label" themeColor="textSecondary" style={styles.section}>
            {cycle ? 'Who owes what' : 'Current totals by member'}
          </ThemedText>
          {renderTotals(currentTotals, !!cycle)}
        </>
      )}

      {cycle && currentTotals.length === 0 && (
        <EmptyState icon="money" title="No closed orders" text="This tally has no closed orders yet." />
      )}

      {cycle && (
        <Card>
          {mine?.confirmed_at ? (
            <Badge tone="success" icon="check">You confirmed</Badge>
          ) : (
            <Button title="Confirm my total" icon="check" onPress={confirm} disabled={busy || !mine} />
          )}
          {isStarter && <Button title="Close cycle" icon="lock" variant="secondary" onPress={close} disabled={busy || !canClose} />}
          {isStarter && !everyoneConfirmed && (
            <ThemedText type="small" themeColor="textSecondary">
              Close unlocks after everyone confirms.
            </ThemedText>
          )}
        </Card>
      )}

      {history.length > 0 && (
        <>
          <ThemedText type="label" themeColor="textSecondary" style={styles.section}>
            Tally history
          </ThemedText>
          {history.map((item) => {
            const itemTotals = historyTotals.filter((t) => t.cycle_id === item.id);
            const itemTotal = itemTotals.reduce((sum, t) => sum + Number(t.grand_total), 0);
            const itemConfirmed = itemTotals.filter((t) => t.confirmed_at).length;
            const expanded = expandedHistory === item.id;
            return (
              <Card key={item.id} style={{ gap: 8 }}>
                <Row>
                  <View style={{ flex: 1, gap: 3 }}>
                    <ThemedText type="smallBold">Tally from {niceDate(item.closed_at ?? item.created_at)}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {historyOrderCounts[item.id] ?? 0} order{(historyOrderCounts[item.id] ?? 0) === 1 ? '' : 's'} · {itemConfirmed}/{itemTotals.length} confirmed
                    </ThemedText>
                  </View>
                  <ThemedText type="smallBold" style={{ fontSize: 17, fontVariant: ['tabular-nums'] }}>
                    {money(itemTotal)}
                  </ThemedText>
                </Row>
                <Button
                  title={expanded ? 'Hide details' : 'View details'}
                  variant="secondary"
                  onPress={() => setExpandedHistory(expanded ? null : item.id)}
                />
                {expanded && (itemTotals.length > 0 ? renderTotals(itemTotals) : <ThemedText type="small" themeColor="textSecondary">No member totals recorded for this tally.</ThemedText>)}
              </Card>
            );
          })}
        </>
      )}

      {history.length === 0 && (
        <EmptyState icon="money" title="No tally history yet" text="Completed tallies will appear here after a cycle is closed." />
      )}
    </ScrollView>
  );
}
