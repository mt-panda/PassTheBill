import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Avatar, Badge, Button, Card, Divider, EmptyState, IconButton, Input, Row, styles } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { CURRENCY, money, niceDate, useSession } from '@/lib/session';
import { supabase, useLive } from '@/lib/supabase';

type Claim = { id: string; member_id: string; units: number; members: { name: string } };
type Item = { id: string; name: string; unit_price: number; qty: number; claims: Claim[] };
type ChargeStatus = 'pending' | 'accepted' | 'rejected';
type Charge = {
  id: string;
  member_id: string;
  label: string;
  amount: number;
  status: ChargeStatus;
  members: { name: string };
};
type Order = {
  id: string;
  title: string;
  ordered_on: string;
  delivery_charge: number;
  status: 'open' | 'closed';
  created_by: string;
  creator: { name: string };
  delivery_exclusions: { member_id: string }[];
  extra_charges: Charge[];
  order_items: Item[];
};
type Share = { member_id: string; items_total: number; delivery_share: number; extras_total: number };

const chargeBadge: Record<ChargeStatus, { tone: 'warning' | 'success' | 'danger'; text: string }> = {
  pending: { tone: 'warning', text: 'Waiting for answer' },
  accepted: { tone: 'success', text: 'Accepted' },
  rejected: { tone: 'danger', text: 'Rejected' },
};

export default function OrderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const me = useSession().member!.id;
  const theme = useTheme();
  const [order, setOrder] = useState<Order | null>();
  const [shares, setShares] = useState<Share[]>([]);
  const [busy, setBusy] = useState(false);
  const [chargeFor, setChargeFor] = useState<string | null>(null);
  const [chargeLabel, setChargeLabel] = useState('');
  const [chargeAmount, setChargeAmount] = useState('');

  async function load() {
    const [o, s] = await Promise.all([
      supabase
        .from('orders')
        .select(
          '*, creator:members(name), delivery_exclusions(member_id), extra_charges(id, member_id, label, amount, status, members(name)), order_items(id, name, unit_price, qty, claims(id, member_id, units, members(name)))'
        )
        .eq('id', id)
        .maybeSingle(),
      supabase
        .from('order_member_totals')
        .select('member_id, items_total, delivery_share, extras_total')
        .eq('order_id', id),
    ]);
    const error = o.error ?? s.error;
    if (error) return Alert.alert('Could not load order', error.message);
    setOrder(o.data as unknown as Order | null);
    setShares(s.data as Share[]);
  }

  useLive('orders,order_items,claims,extra_charges,delivery_exclusions', load);

  async function run(action: () => PromiseLike<{ error: { message: string } | null }>) {
    setBusy(true);
    const { error } = await action();
    if (error) Alert.alert('Could not update', error.message);
    await load();
    setBusy(false);
    return !error;
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
  const unclaimed = items.reduce((s, i) => s + i.qty - i.claims.reduce((t, c) => t + c.units, 0), 0);
  const totalUnits = items.reduce((s, i) => s + i.qty, 0);
  const bill = items.reduce((s, i) => s + i.qty * i.unit_price, 0);
  const excluded = new Set(order.delivery_exclusions.map((x) => x.member_id));
  const charges = order.extra_charges;
  const acceptedExtras = charges.filter((c) => c.status === 'accepted').reduce((s, c) => s + c.amount, 0);
  const unresolved = charges.filter((c) => c.status !== 'accepted');
  const unresolvedAmount = unresolved.reduce((s, c) => s + c.amount, 0);
  const myCharges = charges.filter((c) => c.member_id === me && c.status !== 'accepted');
  const myShare = shares.find((s) => s.member_id === me);

  const names: Record<string, string> = {};
  const eaten: Record<string, { name: string; units: number }[]> = {};
  for (const i of items)
    for (const c of i.claims) {
      names[c.member_id] = c.members.name;
      (eaten[c.member_id] ??= []).push({ name: i.name, units: c.units });
    }
  for (const c of charges) names[c.member_id] ??= c.members.name;
  const people = Object.keys(names).sort((a, b) => (a === me ? -1 : b === me ? 1 : names[a].localeCompare(names[b])));
  const payers = Object.keys(eaten).filter((m) => !excluded.has(m));
  const noPayers = order.delivery_charge > 0 && Object.keys(eaten).length > 0 && payers.length === 0;

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

  function toggleDelivery(memberId: string) {
    run(() =>
      excluded.has(memberId)
        ? supabase.from('delivery_exclusions').delete().eq('order_id', order!.id).eq('member_id', memberId)
        : supabase.from('delivery_exclusions').insert({ order_id: order!.id, member_id: memberId })
    );
  }

  function openChargeForm(memberId: string) {
    setChargeFor(memberId);
    setChargeLabel('');
    setChargeAmount('');
  }

  async function addCharge() {
    const amount = Number(chargeAmount);
    if (!chargeLabel.trim()) return Alert.alert('Say what the charge is for');
    if (!(amount > 0)) return Alert.alert('Enter an amount above zero');
    const ok = await run(() =>
      supabase
        .from('extra_charges')
        .insert({ order_id: order!.id, member_id: chargeFor!, label: chargeLabel.trim(), amount })
    );
    if (ok) setChargeFor(null);
  }

  function removeCharge(c: Charge) {
    Alert.alert('Remove this charge?', `${c.label} · ${money(c.amount)} for ${names[c.member_id]}`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => run(() => supabase.from('extra_charges').delete().eq('id', c.id)) },
    ]);
  }

  function respond(c: Charge, accept: boolean) {
    const send = () => run(() => supabase.rpc('respond_to_charge', { p_charge_id: c.id, p_accept: accept }));
    if (accept) return send();
    Alert.alert('Reject this charge?', `${order!.creator.name} will get a notification.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reject', style: 'destructive', onPress: send },
    ]);
  }

  function close() {
    Alert.alert('Close order?', 'Claims, prices and charges are frozen after closing.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Close', onPress: () => run(() => supabase.rpc('close_order', { p_order_id: order!.id })) },
    ]);
  }

  function remove() {
    Alert.alert('Delete order?', 'All items, claims and charges on it are removed.', [
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

  const closeHint =
    unclaimed > 0
      ? `${unclaimed} still unclaimed. Everything needs an owner before you can close.`
      : unresolved.length > 0
        ? `${unresolved.length} extra charge${unresolved.length > 1 ? 's are' : ' is'} waiting for an answer or rejected. Remove or change ${unresolved.length > 1 ? 'them' : 'it'} to close.`
        : noPayers
          ? 'Everyone is excluded from delivery. At least one person has to share it.'
          : 'Everything is settled. Closing locks the order so totals stay final.';

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
      <ScrollView contentContainerStyle={styles.screen} contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled">
        <Card style={{ gap: 10 }}>
          <Row>
            <ThemedText type="label" themeColor="textSecondary">
              Total bill
            </ThemedText>
            {open ? (
              <Badge tone={unclaimed > 0 || unresolved.length > 0 ? 'warning' : 'success'}>Open</Badge>
            ) : (
              <Badge icon="lock">Closed</Badge>
            )}
          </Row>
          <ThemedText type="title">{money(bill + order.delivery_charge + acceptedExtras)}</ThemedText>
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
            {totalUnits - unclaimed} of {totalUnits} claimed · {niceDate(order.ordered_on)}
          </ThemedText>
          <Divider />
          <Row style={{ justifyContent: 'flex-start' }}>
            <Avatar name={order.creator.name} size={32} />
            <View style={{ flexShrink: 1 }}>
              <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
                Created by
              </ThemedText>
              <ThemedText type="smallBold" numberOfLines={1}>
                {isCreator ? `You (${order.creator.name})` : order.creator.name}
              </ThemedText>
            </View>
          </Row>
        </Card>

        {myCharges.length > 0 && (
          <Card style={{ borderColor: theme.warning, borderWidth: 1.5 }}>
            <Row style={{ justifyContent: 'flex-start' }}>
              <Badge tone="warning" icon="bell">
                Needs your answer
              </Badge>
            </Row>
            {myCharges.map((c, i) => (
              <View key={c.id} style={{ gap: 10 }}>
                {i > 0 && <Divider />}
                <Row style={{ alignItems: 'flex-start' }}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <ThemedText type="smallBold">{c.label}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      Added by {order.creator.name}
                    </ThemedText>
                  </View>
                  <ThemedText type="smallBold" style={{ fontSize: 17 }}>
                    {money(c.amount)}
                  </ThemedText>
                </Row>
                {c.status === 'pending' ? (
                  <Row>
                    <Button title="Reject" variant="danger" small disabled={busy} onPress={() => respond(c, false)} style={{ flex: 1 }} />
                    <Button title="Accept" icon="check" small disabled={busy} onPress={() => respond(c, true)} style={{ flex: 1 }} />
                  </Row>
                ) : (
                  <ThemedText type="small" themeColor="danger">
                    You rejected this. {order.creator.name} has been notified and can remove or change it.
                  </ThemedText>
                )}
              </View>
            ))}
          </Card>
        )}

        {myShare && (
          <Card style={{ backgroundColor: theme.primary, borderColor: theme.primary }}>
            <Row>
              <View style={{ gap: 2 }}>
                <ThemedText type="label" themeColor="onPrimary" style={{ opacity: 0.7 }}>
                  You pay
                </ThemedText>
                <ThemedText type="subtitle" themeColor="onPrimary" style={{ fontVariant: ['tabular-nums'] }}>
                  {money(myShare.items_total + myShare.delivery_share + myShare.extras_total)}
                </ThemedText>
              </View>
              <ThemedText type="small" themeColor="onPrimary" style={{ opacity: 0.7, textAlign: 'right' }}>
                {money(myShare.items_total)} food{'\n'}+ {money(myShare.delivery_share)} delivery
                {myShare.extras_total > 0 && `\n+ ${money(myShare.extras_total)} extra`}
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
            <ThemedText type="small" themeColor="textSecondary" style={{ flexShrink: 1 }}>
              Delivery
              {payers.length > 0 && `, split between ${payers.length} ${payers.length > 1 ? 'people' : 'person'}`}
            </ThemedText>
            <ThemedText type="small">{money(order.delivery_charge)}</ThemedText>
          </Row>
          {acceptedExtras > 0 && (
            <Row>
              <ThemedText type="small" themeColor="textSecondary">
                Extra charges
              </ThemedText>
              <ThemedText type="small">{money(acceptedExtras)}</ThemedText>
            </Row>
          )}
          <Divider />
          <Row>
            <ThemedText type="smallBold">Total</ThemedText>
            <ThemedText type="smallBold">{money(bill + order.delivery_charge + acceptedExtras)}</ThemedText>
          </Row>
          {unresolvedAmount > 0 && (
            <ThemedText type="small" themeColor="warning">
              {money(unresolvedAmount)} in extra charges still waiting for an answer or rejected.
            </ThemedText>
          )}
        </Card>

        {people.length > 0 && (
          <>
            <ThemedText type="label" themeColor="textSecondary" style={styles.section}>
              Who pays what
            </ThemedText>
            {people.map((m) => {
              const share = shares.find((s) => s.member_id === m);
              const theirCharges = charges.filter((c) => c.member_id === m);
              const ate = eaten[m] ?? [];
              const total = share ? share.items_total + share.delivery_share + share.extras_total : 0;
              return (
                <Card key={m}>
                  <Row>
                    <Row style={{ flexShrink: 1 }}>
                      <Avatar name={names[m]} />
                      <ThemedText type="smallBold" numberOfLines={1} style={{ flexShrink: 1 }}>
                        {m === me ? `You (${names[m]})` : names[m]}
                      </ThemedText>
                    </Row>
                    <ThemedText type="smallBold" style={{ fontSize: 17, fontVariant: ['tabular-nums'] }}>
                      {money(total)}
                    </ThemedText>
                  </Row>

                  {ate.length > 0 && (
                    <ThemedText type="small" themeColor="textSecondary">
                      {ate.map((e) => `${e.name} × ${e.units}`).join(' · ')}
                    </ThemedText>
                  )}

                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                    <Badge>{`Food ${money(share?.items_total ?? 0)}`}</Badge>
                    {ate.length > 0 &&
                      (excluded.has(m) ? (
                        <Badge tone="warning">No delivery</Badge>
                      ) : (
                        <Badge icon="delivery">{money(share?.delivery_share ?? 0)}</Badge>
                      ))}
                    {(share?.extras_total ?? 0) > 0 && <Badge>{`Extra ${money(share!.extras_total)}`}</Badge>}
                  </View>

                  {theirCharges.map((c) => (
                    <Row key={c.id}>
                      <View style={{ flex: 1, gap: 4 }}>
                        <ThemedText type="small" numberOfLines={1}>
                          {c.label} · {money(c.amount)}
                        </ThemedText>
                        <Badge tone={chargeBadge[c.status].tone}>{chargeBadge[c.status].text}</Badge>
                      </View>
                      {open && isCreator && (
                        <IconButton icon="close" label={`Remove ${c.label}`} disabled={busy} onPress={() => removeCharge(c)} />
                      )}
                    </Row>
                  ))}

                  {open && isCreator && chargeFor === m && (
                    <View style={{ gap: 10 }}>
                      <Divider />
                      <Input label="What for?" placeholder="e.g. Extra raita" value={chargeLabel} onChangeText={setChargeLabel} />
                      <Input
                        label={`Amount (${CURRENCY})`}
                        placeholder="0"
                        keyboardType="decimal-pad"
                        value={chargeAmount}
                        onChangeText={setChargeAmount}
                      />
                      <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 13 }}>
                        {m === me ? 'Charges to yourself still need your own Accept.' : `${names[m]} gets a notification and has to accept it.`}
                      </ThemedText>
                      <Row>
                        <Button title="Cancel" variant="ghost" small onPress={() => setChargeFor(null)} style={{ flex: 1 }} />
                        <Button title="Add charge" icon="add" small disabled={busy} onPress={addCharge} style={{ flex: 1 }} />
                      </Row>
                    </View>
                  )}

                  {open && isCreator && chargeFor !== m && (
                    <>
                      <Divider />
                      <Row>
                        {ate.length > 0 ? (
                          <Button
                            title={excluded.has(m) ? 'Add to delivery' : 'Skip delivery'}
                            icon="delivery"
                            variant="ghost"
                            small
                            disabled={busy}
                            onPress={() => toggleDelivery(m)}
                          />
                        ) : (
                          <View />
                        )}
                        <Button title="Extra charge" icon="add" variant="secondary" small disabled={busy} onPress={() => openChargeForm(m)} />
                      </Row>
                    </>
                  )}
                </Card>
              );
            })}
          </>
        )}

        {open && isCreator && (
          <View style={{ gap: 10, marginTop: 8 }}>
            <Button
              title="Close order"
              icon="lock"
              disabled={busy || unclaimed > 0 || unresolved.length > 0 || noPayers}
              onPress={close}
            />
            <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center' }}>
              {closeHint}
            </ThemedText>
            <Button title="Delete order" icon="delete" variant="danger" disabled={busy} onPress={remove} />
          </View>
        )}
      </ScrollView>
    </>
  );
}
