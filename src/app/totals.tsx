import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Avatar, Badge, Button, Card, EmptyState, Icon, Row, styles } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { money, niceDate, useSession } from '@/lib/session';
import { summarizeCycle, type BillingCycleSummary, type BillingCycleSummaryInput, type BillingCycleTotalInput } from '@/lib/billing-cycle';
import { supabase, useLive } from '@/lib/supabase';

type Cycle = BillingCycleSummaryInput;

type Total = BillingCycleTotalInput;

type CycleOrder = { cycle_id: string; order_id: string; order: { title: string; ordered_on: string } | null };


export default function TotalsScreen() {
  const member = useSession().member!;
  const theme = useTheme();
  const [cycle, setCycle] = useState<Cycle | null>(null);
  const [totals, setTotals] = useState<Total[]>([]);
  const [openOrders, setOpenOrders] = useState(0);
  const [closedWaiting, setClosedWaiting] = useState(0);
  const [history, setHistory] = useState<BillingCycleSummary[]>([]);
  const [historyTotals, setHistoryTotals] = useState<Record<string, Total[]>>({});
  const [historyOrders, setHistoryOrders] = useState<Record<string, CycleOrder[]>>({});
  const [expandedCycleId, setExpandedCycleId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const [c, h, open, waiting, cycleOrders, cycleTotals] = await Promise.all([
      supabase
        .from('billing_cycles')
        .select('id, triggered_by, status, created_at, closed_at')
        .eq('status', 'open')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('billing_cycles')
        .select('id, triggered_by, status, created_at, closed_at')
        .eq('status', 'closed')
        .order('closed_at', { ascending: false })
        .limit(25),
      supabase.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'open'),
      supabase.from('untallied_closed_orders').select('id', { count: 'exact', head: true }),
      supabase.from('billing_cycle_orders').select('cycle_id, order_id, order:orders(title, ordered_on)'),
      supabase.from('billing_cycle_member_totals').select('*'),
    ]);

    const error = c.error ?? h.error ?? open.error ?? waiting.error ?? cycleOrders.error ?? cycleTotals.error;
    if (error) return Alert.alert('Could not load billing cycles', error.message);

    const nextCycle = (c.data as Cycle | null) ?? null;
    const closedCycles = (h.data as Cycle[]) ?? [];
    const links = (cycleOrders.data as CycleOrder[]) ?? [];
    const allTotals = (cycleTotals.data as Total[]) ?? [];

    setCycle(nextCycle);
    setOpenOrders(open.count ?? 0);
    setClosedWaiting(waiting.count ?? 0);
    setTotals(nextCycle ? allTotals.filter((t) => t.cycle_id === nextCycle.id) : []);

    const grouped: Record<string, Total[]> = {};
    for (const total of allTotals) {
      (grouped[total.cycle_id] ??= []).push(total);
    }
    setHistoryTotals(grouped);

    const groupedOrders: Record<string, CycleOrder[]> = {};
    for (const order of links) {
      (groupedOrders[order.cycle_id] ??= []).push(order);
    }
    setHistoryOrders(groupedOrders);
    setHistory(closedCycles.map((closed) => summarizeCycle(closed, allTotals, links.filter((l) => l.cycle_id === closed.id).length)));

    if (expandedCycleId && !closedCycles.some((closed) => closed.id === expandedCycleId)) {
      setExpandedCycleId(null);
    }
  }

  useLive('orders,order_items,claims,extra_charges,delivery_exclusions,billing_cycles,billing_cycle_orders,billing_cycle_confirmations', load);

  async function run(fn: () => PromiseLike<{ error: Error | null }>) {
    setBusy(true);
    const { error } = await fn();
    if (error) Alert.alert('Could not update billing cycle', error.message);
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

  const activeTotal = totals.reduce((sum, t) => sum + Number(t.grand_total), 0);
  const confirmed = totals.filter((t) => t.confirmed_at).length;
  const mine = totals.find((t) => t.member_id === member.id);
  const isStarter = cycle?.triggered_by === member.id;
  const everyoneConfirmed = totals.length > 0 && confirmed === totals.length;
  const canClose = !!cycle && cycle.status === 'open' && isStarter && everyoneConfirmed;

  return (
    <ScrollView contentContainerStyle={styles.screen} contentInsetAdjustmentBehavior="automatic">
      <Card style={{ gap: 8 }}>
        <ThemedText type="label" themeColor="textSecondary">
          Current tally
        </ThemedText>
        <ThemedText type="title">{money(activeTotal)}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {cycle
            ? `Started ${niceDate(cycle.created_at)}. ${confirmed} of ${totals.length} members confirmed.`
            : closedWaiting > 0
              ? `${closedWaiting} closed order${closedWaiting > 1 ? 's are' : ' is'} ready for the next billing cycle.`
              : 'Start a tally whenever your team is ready. It includes closed orders that have not been tallied yet.'}
        </ThemedText>
      </Card>

      {!cycle && (
        closedWaiting === 0 ? (
          <EmptyState icon="money" title="Nothing ready" text="Close orders first, then start a billing cycle for your team." />
        ) : (
          <Button title={`Start tally (${closedWaiting} order${closedWaiting > 1 ? 's' : ''})`} icon="bell" onPress={trigger} disabled={busy} />
        )
      )}

      {cycle && (
        <>
          {openOrders > 0 && (
            <Card style={{ backgroundColor: theme.warningSoft, borderColor: theme.warningSoft, flexDirection: 'row' }}>
              <Icon name="info" size={20} color="warning" />
              <ThemedText type="small" themeColor="warning" style={{ flex: 1 }}>
                {openOrders} open order{openOrders > 1 ? 's are' : ' is'} not in this tally. Closing skips them into the next cycle.
              </ThemedText>
            </Card>
          )}

          {totals.length === 0 ? (
            <EmptyState icon="money" title="No members" text="This tally has no team members to confirm yet." />
          ) : (
            <>
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
                  {t.confirmed_at ? (
                    <Badge tone="success" icon="check">{`Confirmed ${niceDate(t.confirmed_at)}`}</Badge>
                  ) : (
                    <Badge tone="warning">Waiting</Badge>
                  )}
                </Card>
              ))}
            </>
          )}

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
        </>
      )}

      {history.length > 0 && (
        <>
          <ThemedText type="label" themeColor="textSecondary" style={styles.section}>
            Previous billing cycles
          </ThemedText>
          {history.map((item) => {
            const expanded = expandedCycleId === item.id;
            const cycleMemberTotals = historyTotals[item.id] ?? [];
            const cycleOrders = historyOrders[item.id] ?? [];
            return (
              <Card key={item.id}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ expanded }}
                  onPress={() => setExpandedCycleId(expanded ? null : item.id)}
                  style={({ pressed }) => pressed && { opacity: 0.7 }}>
                  <Row>
                    <View style={{ flex: 1, gap: 5 }}>
                      <Row>
                        <ThemedText type="smallBold">{niceDate(item.closed_at ?? item.created_at)}</ThemedText>
                        <Badge tone="success" icon="check">Closed</Badge>
                      </Row>
                      <ThemedText type="small" themeColor="textSecondary">
                        {item.order_count} order{item.order_count !== 1 ? 's' : ''} · {item.confirmed_count}/{item.member_count} confirmed
                      </ThemedText>
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 4 }}>
                      <ThemedText type="smallBold" style={{ fontSize: 17, fontVariant: ['tabular-nums'] }}>
                        {money(item.total)}
                      </ThemedText>
                      <Icon name={expanded ? 'back' : 'forward'} size={14} color="textSecondary" />
                    </View>
                  </Row>
                </Pressable>

                {expanded && (
                  <>
                    <ThemedText type="label" themeColor="textSecondary" style={styles.section}>
                      Orders in this cycle
                    </ThemedText>
                    {cycleOrders.map((order) => (
                      <Row key={order.order_id}>
                        <Row style={{ flex: 1 }}>
                          <Icon name="receipt" size={18} color="textSecondary" />
                          <View style={{ flex: 1 }}>
                            <ThemedText type="smallBold" numberOfLines={1}>
                              {order.order?.title || 'Lunch'}
                            </ThemedText>
                            {order.order?.ordered_on && (
                              <ThemedText type="small" themeColor="textSecondary">
                                {niceDate(order.order.ordered_on)}
                              </ThemedText>
                            )}
                          </View>
                        </Row>
                      </Row>
                    ))}

                    <ThemedText type="label" themeColor="textSecondary" style={styles.section}>
                      Final totals
                    </ThemedText>
                    {cycleMemberTotals.map((t) => (
                      <Row key={t.member_id}>
                        <Row style={{ flex: 1 }}>
                          <Avatar name={t.member_name} size={34} />
                          <View style={{ flex: 1, gap: 2 }}>
                            <ThemedText type="smallBold" numberOfLines={1}>
                              {t.member_id === member.id ? `${t.member_name} (you)` : t.member_name}
                            </ThemedText>
                            <ThemedText type="small" themeColor="textSecondary">
                              {money(t.items_total)} food + {money(t.delivery_total)} delivery
                              {t.extras_total > 0 && ` + ${money(t.extras_total)} extra`}
                            </ThemedText>
                          </View>
                        </Row>
                        <ThemedText type="smallBold" style={{ fontVariant: ['tabular-nums'] }}>
                          {money(t.grand_total)}
                        </ThemedText>
                      </Row>
                    ))}
                  </>
                )}
              </Card>
            );
          })}
        </>
      )}
    </ScrollView>
  );
}
