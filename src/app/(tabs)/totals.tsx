import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Avatar, Badge, Button, Card, Icon, Row, styles } from '@/components/ui';
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

export default function TotalsScreen() {
  const { member } = useSession();
  const me = member!;
  const theme = useTheme();

  const [cycle, setCycle] = useState<Cycle | null>(null);
  const [totals, setTotals] = useState<Total[]>([]);
  const [history, setHistory] = useState<Cycle[]>([]);
  const [historyTotals, setHistoryTotals] = useState<Record<string, Total[]>>({});
  const [selectedHistory, setSelectedHistory] = useState<Cycle | null>(null);
  const [openOrders, setOpenOrders] = useState(0);
  const [closedWaiting, setClosedWaiting] = useState(0);
  const [busy, setBusy] = useState(false);

  async function load() {
    const [active, open, waiting, closed] = await Promise.all([
      supabase
        .from('billing_cycles')
        .select('id, triggered_by, status, created_at, closed_at')
        .eq('status', 'open')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'open'),
      supabase.from('untallied_closed_orders').select('id', { count: 'exact', head: true }),
      supabase
        .from('billing_cycles')
        .select('id, triggered_by, status, created_at, closed_at')
        .eq('status', 'closed')
        .order('closed_at', { ascending: false })
        .limit(20),
    ]);

    const error = active.error ?? open.error ?? waiting.error ?? closed.error;
    if (error) return Alert.alert('Could not load tally', error.message);

    const activeCycle = (active.data as Cycle | null) ?? null;
    setCycle(activeCycle);
    setOpenOrders(open.count ?? 0);
    setClosedWaiting(waiting.count ?? 0);
    setHistory((closed.data as Cycle[]) ?? []);

    if (activeCycle) {
      const t = await supabase
        .from('billing_cycle_member_totals')
        .select('*')
        .eq('cycle_id', activeCycle.id)
        .order('member_name');

      if (t.error) return Alert.alert('Could not load totals', t.error.message);
      setTotals((t.data as Total[]) ?? []);
    } else {
      setTotals([]);
    }

    const historyRows = (closed.data as Cycle[]) ?? [];
    if (historyRows.length) {
      const { data, error: historyError } = await supabase
        .from('billing_cycle_member_totals')
        .select('*')
        .in('cycle_id', historyRows.map((c) => c.id))
        .order('member_name');

      if (historyError) return Alert.alert('Could not load tally history', historyError.message);

      const grouped: Record<string, Total[]> = {};
      for (const row of (data as Total[]) ?? []) {
        (grouped[row.cycle_id] ??= []).push(row);
      }
      setHistoryTotals(grouped);
    } else {
      setHistoryTotals({});
    }
  }

  useEffect(() => {
    load();
  }, []);

  useLive(
    'orders,order_items,claims,extra_charges,delivery_exclusions,billing_cycles,billing_cycle_confirmations',
    load
  );

  async function run(fn: () => PromiseLike<{ error: Error | null }>) {
    setBusy(true);
    const { error } = await fn();
    if (error) Alert.alert('Could not update tally', error.message);
    await load();
    setBusy(false);
  }

  const trigger = () => run(() => supabase.rpc('trigger_billing_cycle'));
  const confirm = () =>
    cycle && run(() => supabase.rpc('confirm_billing_cycle', { p_cycle_id: cycle.id }));

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

  const teamTotal = totals.reduce((sum, t) => sum + t.grand_total, 0);
  const participatingTotals = totals.filter((t) => t.grand_total > 0);
  const confirmed = participatingTotals.filter((t) => t.confirmed_at).length;
  const mine = totals.find((t) => t.member_id === me.id);
  const isStarter = cycle?.triggered_by === me.id;
  const everyoneConfirmed =
    participatingTotals.length === 0 || confirmed === participatingTotals.length;
  const canClose = !!cycle && isStarter && everyoneConfirmed;

  const selectedTotals = selectedHistory ? historyTotals[selectedHistory.id] ?? [] : [];
  const selectedTotal = selectedTotals.reduce((sum, t) => sum + t.grand_total, 0);

  return (
    <>
      <ScrollView contentContainerStyle={styles.screen} contentInsetAdjustmentBehavior="automatic">
        <View style={{ gap: 4 }}>
          <ThemedText type="title">Totals</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Your team&apos;s current tally and previous cycles.
          </ThemedText>
        </View>

        {!cycle ? (
          <Card style={{ gap: 12 }}>
            <Row>
              <View style={{ gap: 3, flex: 1 }}>
                <ThemedText type="label" themeColor="textSecondary">CURRENT CYCLE</ThemedText>
                <ThemedText type="title">{money(0)}</ThemedText>
              </View>
              <Icon name="money" size={28} color="textSecondary" />
            </Row>

            {closedWaiting > 0 ? (
              <Button
                title={`Start tally · ${closedWaiting} order${closedWaiting > 1 ? 's' : ''}`}
                icon="chart"
                onPress={trigger}
                disabled={busy}
              />
            ) : (
              <ThemedText type="small" themeColor="textSecondary">
                Close orders first, then start a tally.
              </ThemedText>
            )}
          </Card>
        ) : (
          <>
            <Card style={{ gap: 12 }}>
              <Row>
                <View style={{ gap: 3, flex: 1 }}>
                  <ThemedText type="label" themeColor="textSecondary">CURRENT TALLY</ThemedText>
                  <ThemedText type="title">{money(teamTotal)}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {confirmed} of {participatingTotals.length} participating members confirmed
                  </ThemedText>
                </View>
                <Badge tone={everyoneConfirmed ? 'success' : 'warning'} icon={everyoneConfirmed ? 'check' : 'bell'}>
                  {everyoneConfirmed ? 'Ready to close' : 'Awaiting confirmation'}
                </Badge>
              </Row>

              {mine && (
                <View style={{ backgroundColor: theme.backgroundSelected, borderRadius: 16, padding: 14 }}>
                  <Row>
                    <View style={{ gap: 2 }}>
                      <ThemedText type="small" themeColor="textSecondary">YOUR TOTAL</ThemedText>
                      <ThemedText type="smallBold" style={{ fontSize: 21 }}>{money(mine.grand_total)}</ThemedText>
                    </View>
                    {mine.confirmed_at && <Badge tone="success" icon="check">Confirmed</Badge>}
                  </Row>
                </View>
              )}
            </Card>

            {openOrders > 0 && (
              <View style={{ paddingHorizontal: 4 }}>
                <ThemedText type="small" themeColor="textSecondary">
                  {openOrders} open order{openOrders > 1 ? 's' : ''} will be carried into the next cycle.
                </ThemedText>
              </View>
            )}

            {totals.length > 0 && (
              <Card style={{ gap: 0 }}>
                <Row style={{ paddingBottom: 12 }}>
                  <ThemedText type="label" themeColor="textSecondary">TEAM BREAKDOWN</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">{totals.length} people</ThemedText>
                </Row>

                {totals.map((t, index) => (
                  <View key={t.member_id}>
                    {index > 0 && <View style={{ height: 1, backgroundColor: theme.border }} />}
                    <View style={{ paddingVertical: 12 }}>
                      <Row>
                        <Row style={{ flex: 1, minWidth: 0 }}>
                          <Avatar name={t.member_name} size={38} />
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <ThemedText type="smallBold" numberOfLines={1}>
                              {t.member_id === me.id ? `${t.member_name} (you)` : t.member_name}
                            </ThemedText>
                            <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                              {money(t.items_total)} food · {money(t.delivery_total)} delivery
                              {t.extras_total > 0 ? ` · ${money(t.extras_total)} extra` : ''}
                            </ThemedText>
                          </View>
                        </Row>
                        <ThemedText type="smallBold" style={{ fontSize: 17 }}>
                          {money(t.grand_total)}
                        </ThemedText>
                      </Row>
                    </View>
                  </View>
                ))}
              </Card>
            )}

            <Card style={{ gap: 10 }}>
              {mine && mine.grand_total > 0 && !mine.confirmed_at && (
                <Button title="Confirm my total" icon="check" onPress={confirm} disabled={busy} />
              )}
              {isStarter && (
                <Button
                  title="Close cycle"
                  icon="lock"
                  variant="secondary"
                  onPress={close}
                  disabled={busy || !canClose}
                />
              )}
              {isStarter && !everyoneConfirmed && (
                <ThemedText type="small" themeColor="textSecondary">
                  You can close the cycle after all participating members confirm.
                </ThemedText>
              )}
            </Card>
          </>
        )}

        <View style={{ gap: 8 }}>
          <ThemedText type="label" themeColor="textSecondary" style={styles.section}>
            HISTORY
          </ThemedText>

          {history.length === 0 ? (
            <ThemedText type="small" themeColor="textSecondary" style={{ paddingHorizontal: 4 }}>
              Completed tallies will appear here.
            </ThemedText>
          ) : (
            <Card style={{ gap: 0 }}>
              {history.map((item, index) => {
                const rows = historyTotals[item.id] ?? [];
                const total = rows.reduce((sum, t) => sum + t.grand_total, 0);
                return (
                  <View key={item.id}>
                    {index > 0 && <View style={{ height: 1, backgroundColor: theme.border }} />}
                    <Pressable
                      onPress={() => setSelectedHistory(item)}
                      style={{ paddingVertical: 14 }}
                    >
                      <Row>
                        <View style={{ flex: 1, gap: 3 }}>
                          <ThemedText type="smallBold">
                            Tally · {item.closed_at ? niceDate(item.closed_at) : niceDate(item.created_at)}
                          </ThemedText>
                          <ThemedText type="small" themeColor="textSecondary">
                            {rows.length} people · {money(total)}
                          </ThemedText>
                        </View>
                        <Icon name="forward" size={16} color="textSecondary" />
                      </Row>
                    </Pressable>
                  </View>
                );
              })}
            </Card>
          )}
        </View>
      </ScrollView>

      <Modal
        visible={!!selectedHistory}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedHistory(null)}
      >
        <Pressable
          onPress={() => setSelectedHistory(null)}
          style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.35)' }}
        >
          <Pressable
            onPress={(event) => event.stopPropagation()}
            style={{
              backgroundColor: theme.backgroundElement,
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              padding: 20,
              paddingBottom: 32,
              maxHeight: '80%',
            }}
          >
            <View style={{ alignItems: 'center', marginBottom: 14 }}>
              <View style={{ width: 42, height: 4, borderRadius: 4, backgroundColor: theme.border }} />
            </View>

            {selectedHistory && (
              <>
                <Row>
                  <View style={{ gap: 3, flex: 1 }}>
                    <ThemedText type="subtitle">Completed tally</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {selectedHistory.closed_at ? niceDate(selectedHistory.closed_at) : niceDate(selectedHistory.created_at)}
                    </ThemedText>
                  </View>
                  <ThemedText type="smallBold" style={{ fontSize: 20 }}>{money(selectedTotal)}</ThemedText>
                </Row>

                <ScrollView style={{ marginTop: 16 }}>
                  {selectedTotals.map((t) => (
                    <View key={t.member_id} style={{ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.border }}>
                      <Row>
                        <Row style={{ flex: 1, minWidth: 0 }}>
                          <Avatar name={t.member_name} size={36} />
                          <View style={{ flex: 1 }}>
                            <ThemedText type="smallBold" numberOfLines={1}>{t.member_name}</ThemedText>
                            <ThemedText type="small" themeColor="textSecondary">
                              {money(t.items_total)} food · {money(t.delivery_total)} delivery
                              {t.extras_total > 0 ? ` · ${money(t.extras_total)} extra` : ''}
                            </ThemedText>
                          </View>
                        </Row>
                        <ThemedText type="smallBold">{money(t.grand_total)}</ThemedText>
                      </Row>
                    </View>
                  ))}
                </ScrollView>

                <Button title="Close" variant="secondary" onPress={() => setSelectedHistory(null)} style={{ marginTop: 14 }} />
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
