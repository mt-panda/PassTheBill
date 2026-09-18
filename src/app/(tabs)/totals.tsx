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

export default function TotalsScreen() {
  const member = useSession().member!;
  const theme = useTheme();
  const [cycle, setCycle] = useState<Cycle | null>(null);
  const [totals, setTotals] = useState<Total[]>([]);
  const [openOrders, setOpenOrders] = useState(0);
  const [closedWaiting, setClosedWaiting] = useState(0);
  const [busy, setBusy] = useState(false);

  async function load() {
    const [c, open, waiting] = await Promise.all([
      supabase
        .from('billing_cycles')
        .select('id, triggered_by, status, created_at, closed_at')
        .eq('status', 'open')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'open'),
      supabase.from('untallied_closed_orders').select('id', { count: 'exact', head: true }),
    ]);
    const error = c.error ?? open.error ?? waiting.error;
    if (error) return Alert.alert('Could not load tally', error.message);

    setCycle((c.data as Cycle | null) ?? null);
    setOpenOrders(open.count ?? 0);
    setClosedWaiting(waiting.count ?? 0);

    if (!c.data) return setTotals([]);
    const t = await supabase.from('billing_cycle_member_totals').select('*').eq('cycle_id', c.data.id).order('member_name');
    if (t.error) return Alert.alert('Could not load totals', t.error.message);
    setTotals(t.data as Total[]);
  }

  useLive('orders,order_items,claims,extra_charges,delivery_exclusions,billing_cycles,billing_cycle_confirmations', load);

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

  const teamTotal = totals.reduce((s, t) => s + t.grand_total, 0);
  const confirmed = totals.filter((t) => t.confirmed_at).length;
  const mine = totals.find((t) => t.member_id === member.id);
  const isStarter = cycle?.triggered_by === member.id;
  const everyoneConfirmed = totals.length > 0 && confirmed === totals.length;
  const canClose = !!cycle && cycle.status === 'open' && isStarter && everyoneConfirmed;

  return (
    <ScrollView contentContainerStyle={styles.screen} contentInsetAdjustmentBehavior="automatic">
      {!cycle ? (
        <>
          <Card style={{ gap: 8 }}>
            <ThemedText type="label" themeColor="textSecondary">
              Current tally
            </ThemedText>
            <ThemedText type="title">{money(0)}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Start a tally whenever your team is ready. It includes closed orders that have not been tallied yet.
            </ThemedText>
          </Card>
          {closedWaiting === 0 ? (
            <EmptyState icon="money" title="Nothing ready" text="Close orders first, then start a tally for your team." />
          ) : (
            <Button title={`Start tally (${closedWaiting} order${closedWaiting > 1 ? 's' : ''})`} icon="bell" onPress={trigger} disabled={busy} />
          )}
        </>
      ) : (
        <>
          <Card style={{ gap: 6 }}>
            <Row>
              <ThemedText type="label" themeColor="textSecondary">
                Active tally
              </ThemedText>
              <Badge tone="warning" icon="bell">Confirming</Badge>
            </Row>
            <ThemedText type="title">{money(teamTotal)}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Started {niceDate(cycle.created_at)}. {confirmed} of {totals.length} confirmed.
            </ThemedText>
          </Card>

          {openOrders > 0 && (
            <Card style={{ backgroundColor: theme.warningSoft, borderColor: theme.warningSoft, flexDirection: 'row' }}>
              <Icon name="info" size={20} color="warning" />
              <ThemedText type="small" themeColor="warning" style={{ flex: 1 }}>
                {openOrders} open order{openOrders > 1 ? 's are' : ' is'} not in this tally. Closing skips them into the next cycle.
              </ThemedText>
            </Card>
          )}

          {totals.length === 0 ? (
            <EmptyState icon="money" title="No closed orders" text="This tally has no closed orders yet." />
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
    </ScrollView>
  );
}
