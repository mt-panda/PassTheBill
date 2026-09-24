import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import {
  BottomSheet,
  Button,
  Card,
  Divider,
  EmptyState,
  ErrorState,
  FoodThumb,
  Icon,
  IconButton,
  Input,
  ListRow,
  QuantityStepper,
  Row,
  Screen,
  SectionHeader,
  Skeleton,
  StatusBadge,
  useToast,
} from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useOrder, type Charge, type Teammate } from '@/features/orders/use-order';
import type { FriendlyError } from '@/lib/errors';
import { dayLabel, money, parseAmount, splitRound } from '@/lib/format';

export { RouteErrorBoundary as ErrorBoundary } from '@/components/ui';

const FORMER = 'Former member';

type Sheet =
  | null
  | { kind: 'bill' | 'share' | 'everyone' | 'adopt' }
  | { kind: 'decline'; charge: Charge }
  | { kind: 'options'; view: 'menu' | 'delivery' | 'charges' | 'addCharge' | 'close' | 'delete' };

const CHARGE_STATUS = { pending: 'Waiting', accepted: 'Accepted', rejected: 'Declined' } as const;

export default function OrderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const theme = useTheme();
  const o = useOrder(id);
  const { me, order, shares, pending } = o;
  const [sheet, setSheet] = useState<Sheet>(null);
  const [busy, setBusy] = useState(false);
  const [sheetError, setSheetError] = useState<string | null>(null);
  const [team, setTeam] = useState<Teammate[]>([]);
  const [charge, setCharge] = useState({ for: '', label: '', amount: '' });
  const editCharge = (patch: Partial<typeof charge>) => {
    setCharge((c) => ({ ...c, ...patch }));
    setSheetError(null);
  };

  const closeSheet = () => {
    setSheet(null);
    setSheetError(null);
  };
  // Runs an action from inside a sheet: errors stay in the sheet, success runs `then`.
  async function inSheet(action: () => Promise<FriendlyError | null>, then?: () => void) {
    setBusy(true);
    const err = await action();
    setBusy(false);
    if (err) return setSheetError(err.message);
    setSheetError(null);
    then?.();
  }

  if (order === undefined) {
    return (
      <Screen nativeHeader>
        {o.loadError ? (
          <ErrorState message={o.loadError.message} onRetry={o.reload} />
        ) : (
          <>
            <Skeleton height={28} width="50%" />
            <Skeleton.Row />
            <Skeleton.Row />
            <Skeleton.Row />
          </>
        )}
      </Screen>
    );
  }
  if (order === null) {
    return (
      <Screen nativeHeader scroll={false} contentStyle={{ justifyContent: 'center' }}>
        <EmptyState
          icon="delete"
          title="This lunch was removed"
          text="Someone deleted it."
          action={{ label: 'Back to orders', onPress: () => router.replace('/') }}
        />
      </Screen>
    );
  }

  const open = order.status === 'open';
  const isCreator = order.created_by === me;
  const creatorLeft = order.creator === null;
  const creatorName = isCreator ? 'you' : (order.creator?.name ?? FORMER);
  const items = [...order.order_items].sort((a, b) => a.name.localeCompare(b.name));
  const totalUnits = items.reduce((s, i) => s + i.qty, 0);
  const picked = items.reduce((s, i) => s + i.claims.reduce((t, c) => t + c.units, 0), 0);
  const unpicked = totalUnits - picked;
  const food = items.reduce((s, i) => s + i.qty * i.unit_price, 0);
  const excluded = new Set(order.delivery_exclusions.map((x) => x.member_id));
  const charges = order.extra_charges;
  const acceptedExtras = charges.filter((c) => c.status === 'accepted').reduce((s, c) => s + c.amount, 0);
  const pendingCharges = charges.filter((c) => c.status === 'pending');
  const declinedCharges = charges.filter((c) => c.status === 'rejected');
  const unresolvedAmount = [...pendingCharges, ...declinedCharges].reduce((s, c) => s + c.amount, 0);
  const myCharges = charges.filter((c) => c.member_id === me && c.status !== 'accepted');
  const myShare = shares.find((s) => s.member_id === me);
  const myTotal = myShare ? myShare.items_total + myShare.delivery_share + myShare.extras_total : 0;
  const orderTotal = food + order.delivery_charge + acceptedExtras;

  // People who ate or were charged, viewer first.
  const names: Record<string, string> = {};
  const eaten: Record<string, { name: string; units: number }[]> = {};
  for (const i of items)
    for (const c of i.claims) {
      names[c.member_id] = c.members?.name ?? FORMER;
      (eaten[c.member_id] ??= []).push({ name: i.name, units: c.units });
    }
  for (const c of charges) names[c.member_id] ??= c.members?.name ?? FORMER;
  const people = Object.keys(names).sort((a, b) => (a === me ? -1 : b === me ? 1 : names[a].localeCompare(names[b])));
  const label = (m: string) => (m === me ? 'You' : names[m]);
  const payers = Object.keys(eaten).filter((m) => !excluded.has(m));
  const noPayers = order.delivery_charge > 0 && Object.keys(eaten).length > 0 && payers.length === 0;

  const closeReasons = [
    unpicked > 0 && `${unpicked} item${unpicked > 1 ? 's' : ''} not picked yet`,
    pendingCharges.length > 0 && `Waiting on ${pendingCharges.length} charge answer${pendingCharges.length > 1 ? 's' : ''}`,
    declinedCharges.length > 0 &&
      `${declinedCharges.length} declined charge${declinedCharges.length > 1 ? 's' : ''}: remove or change ${declinedCharges.length > 1 ? 'them' : 'it'}`,
    noPayers && 'Nobody shares delivery',
  ].filter(Boolean) as string[];

  const anyPending = Object.keys(pending).length > 0;

  async function onPick(itemId: string, delta: 1 | -1) {
    const item = items.find((i) => i.id === itemId)!;
    const err = await o.pick(item, delta);
    if (err) toast.show(err.message);
  }

  function done() {
    toast.show('Saved');
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }

  async function openAddCharge() {
    setTeam(await o.teammates());
    setCharge({ for: '', label: '', amount: '' });
    setSheet({ kind: 'options', view: 'addCharge' });
  }

  const optionsView = sheet?.kind === 'options' ? sheet.view : null;
  const toMenu = () => {
    setSheetError(null);
    setSheet({ kind: 'options', view: 'menu' });
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: order.title || 'Lunch',
          headerRight:
            open && isCreator
              ? () => <IconButton icon="more" label="Order options" onPress={() => setSheet({ kind: 'options', view: 'menu' })} />
              : undefined,
        }}
      />
      <Screen
        nativeHeader
        onRefresh={o.reload}
        footer={
          <Row>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Your total ${money(myTotal)}. Show breakdown`}
              onPress={() => setSheet({ kind: 'share' })}
              style={{ flexShrink: 1 }}>
              <ThemedText type="small" themeColor="textSecondary">
                Your total
              </ThemedText>
              <ThemedText type="amount" style={{ fontSize: 20, lineHeight: 26 }}>
                {money(myTotal)}
              </ThemedText>
            </Pressable>
            <Button
              title={open ? 'Done' : 'Back'}
              loading={anyPending}
              onPress={done}
              style={{ minWidth: 140 }}
            />
          </Row>
        }>
        <View style={{ gap: Spacing.sm }}>
          <Row style={{ justifyContent: 'flex-start', flexWrap: 'wrap' }}>
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={1} style={{ flexShrink: 1 }}>
              {dayLabel(order.ordered_on)} · by {creatorName}
            </ThemedText>
            <StatusBadge status={open ? 'open' : 'closed'} />
          </Row>
          <View
            accessibilityRole="progressbar"
            accessibilityLabel="Items picked"
            accessibilityValue={{ min: 0, max: totalUnits, now: picked }}
            style={{ height: 6, borderRadius: 3, backgroundColor: theme.backgroundSelected }}>
            <View
              style={{
                height: 6,
                borderRadius: 3,
                width: `${totalUnits ? (picked / totalUnits) * 100 : 0}%`,
                backgroundColor: theme.primary,
              }}
            />
          </View>
          <Row>
            <ThemedText type="small" themeColor="textSecondary">
              {picked} of {totalUnits} picked
            </ThemedText>
            <Pressable accessibilityRole="button" hitSlop={12} onPress={() => setSheet({ kind: 'bill' })}>
              <ThemedText type="bodyStrong" themeColor="primaryText">
                Order total {money(orderTotal)}
              </ThemedText>
            </Pressable>
          </Row>
        </View>

        {open && creatorLeft && (
          <Card tone="warning">
            <ThemedText type="bodyStrong">The person who created this lunch left the team.</ThemedText>
            <Button title="Take over this lunch" variant="secondary" onPress={() => setSheet({ kind: 'adopt' })} />
          </Card>
        )}

        {myCharges.map((c) => (
          <Card key={c.id} tone="warning">
            <Row style={{ alignItems: 'flex-start' }}>
              <View style={{ flex: 1, gap: 2 }}>
                <ThemedText type="bodyStrong">Extra charge · {c.label}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  From {order.creator?.name ?? FORMER}
                </ThemedText>
              </View>
              <ThemedText type="amount">{money(c.amount)}</ThemedText>
            </Row>
            {c.status === 'pending' ? (
              <Row>
                <Button title="Decline" variant="danger" size="sm" onPress={() => setSheet({ kind: 'decline', charge: c })} style={{ flex: 1 }} />
                <Button
                  title="Accept"
                  variant="secondary"
                  size="sm"
                  icon="check"
                  onPress={async () => {
                    const err = await o.respond(c.id, true);
                    if (err) toast.show(err.message);
                  }}
                  style={{ flex: 1 }}
                />
              </Row>
            ) : (
              <ThemedText type="small" themeColor="warningText">
                You declined this charge. {isCreator ? 'Remove or change it in Order options' : `${order.creator?.name ?? 'The creator'} needs to remove or change it`} before the order can close.
              </ThemedText>
            )}
          </Card>
        ))}

        <SectionHeader title={open ? 'What are you having?' : 'What everyone had'} />
        <Card style={{ gap: 0, paddingVertical: Spacing.sm }}>
          {items.map((item, idx) => {
            const taken = item.claims.reduce((s, c) => s + c.units, 0);
            const serverMine = item.claims.find((c) => c.member_id === me)?.units ?? 0;
            const mine = pending[item.id] ?? serverMine;
            const left = item.qty - taken - (mine - serverMine);
            const who = [...item.claims]
              .sort((a, b) => (a.member_id === me ? -1 : b.member_id === me ? 1 : 0))
              .map((c) => `${c.member_id === me ? 'You' : (c.members?.name ?? FORMER)} ×${c.units}`);
            const whoText = who.length > 3 ? `${who.slice(0, 3).join(', ')} +${who.length - 3}` : who.join(', ');
            return (
              <View key={item.id}>
                {idx > 0 && <Divider />}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.md }}>
                  <FoodThumb uri={item.image_url} />
                  <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                    <ThemedText type="bodyStrong" numberOfLines={2}>
                      {item.name}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                      {money(item.unit_price)} · {left > 0 ? `${left} left` : 'All taken'}
                    </ThemedText>
                    {whoText ? (
                      <ThemedText type="caption" themeColor="textSecondary" numberOfLines={1}>
                        {whoText}
                      </ThemedText>
                    ) : null}
                  </View>
                  {open && (
                    <QuantityStepper
                      value={mine}
                      max={mine + Math.max(0, left)}
                      pending={item.id in pending}
                      onChange={(v) => onPick(item.id, v > mine ? 1 : -1)}
                      itemName={item.name}
                    />
                  )}
                </View>
              </View>
            );
          })}
        </Card>
        {people.length > 0 && (
          <Button title="See everyone's share" variant="ghost" icon="people" onPress={() => setSheet({ kind: 'everyone' })} />
        )}
      </Screen>

      {/* Bill */}
      <BottomSheet visible={sheet?.kind === 'bill'} onClose={closeSheet} title="Bill">
        <Row>
          <ThemedText type="body" themeColor="textSecondary">Food</ThemedText>
          <ThemedText type="amount">{money(food)}</ThemedText>
        </Row>
        <Row>
          <ThemedText type="body" themeColor="textSecondary" style={{ flexShrink: 1 }}>
            Delivery{payers.length > 0 && `, split between ${payers.length} ${payers.length > 1 ? 'people' : 'person'}`}
          </ThemedText>
          <ThemedText type="amount">{money(order.delivery_charge)}</ThemedText>
        </Row>
        {acceptedExtras > 0 && (
          <Row>
            <ThemedText type="body" themeColor="textSecondary">Extra charges</ThemedText>
            <ThemedText type="amount">{money(acceptedExtras)}</ThemedText>
          </Row>
        )}
        <Divider />
        <Row>
          <ThemedText type="bodyStrong">Total</ThemedText>
          <ThemedText type="amount">{money(orderTotal)}</ThemedText>
        </Row>
        {unresolvedAmount > 0 && (
          <ThemedText type="small" themeColor="warningText">
            {money(unresolvedAmount)} in extra charges is still waiting or declined.
          </ThemedText>
        )}
      </BottomSheet>

      {/* Your share */}
      <BottomSheet visible={sheet?.kind === 'share'} onClose={closeSheet} title="Your share">
        {(() => {
          const parts = myShare ? [myShare.items_total, myShare.delivery_share, myShare.extras_total] : [0, 0, 0];
          const [f, d, x] = splitRound(parts, myTotal);
          return (
            <>
              <Row>
                <ThemedText type="body" themeColor="textSecondary">Food</ThemedText>
                <ThemedText type="amount">{money(f)}</ThemedText>
              </Row>
              <Row>
                <ThemedText type="body" themeColor="textSecondary">Delivery share</ThemedText>
                <ThemedText type="amount">{money(d)}</ThemedText>
              </Row>
              <Row>
                <ThemedText type="body" themeColor="textSecondary">Extras</ThemedText>
                <ThemedText type="amount">{money(x)}</ThemedText>
              </Row>
              <Divider />
              <Row>
                <ThemedText type="bodyStrong">Your total</ThemedText>
                <ThemedText type="amount">{money(myTotal)}</ThemedText>
              </Row>
            </>
          );
        })()}
      </BottomSheet>

      {/* Everyone's share */}
      <BottomSheet visible={sheet?.kind === 'everyone'} onClose={closeSheet} title="Everyone's share">
        {people.map((m) => {
          const s = shares.find((x) => x.member_id === m);
          const total = s ? s.items_total + s.delivery_share + s.extras_total : 0;
          const [f, d, x] = splitRound(s ? [s.items_total, s.delivery_share, s.extras_total] : [0, 0, 0], total);
          return (
            <View key={m} style={{ gap: Spacing.xs }}>
              <Row>
                <ThemedText type="bodyStrong" numberOfLines={1} style={{ flexShrink: 1 }}>
                  {label(m)}
                </ThemedText>
                <ThemedText type="amount">{money(total)}</ThemedText>
              </Row>
              {(eaten[m] ?? []).length > 0 && (
                <ThemedText type="small" themeColor="textSecondary">
                  {eaten[m].map((e) => `${e.name} ×${e.units}`).join(', ')}
                </ThemedText>
              )}
              <ThemedText type="caption" themeColor="textSecondary">
                Food {money(f)} · Delivery {money(d)} · Extras {money(x)}
                {excluded.has(m) ? ' · Doesn’t share delivery' : ''}
              </ThemedText>
              {charges
                .filter((c) => c.member_id === m)
                .map((c) => (
                  <Row key={c.id} style={{ justifyContent: 'flex-start' }}>
                    <ThemedText type="small" numberOfLines={1} style={{ flexShrink: 1 }}>
                      {c.label} · {money(c.amount)}
                    </ThemedText>
                    <StatusBadge status={c.status === 'accepted' ? 'confirmed' : 'waiting'} label={CHARGE_STATUS[c.status]} />
                  </Row>
                ))}
              <Divider />
            </View>
          );
        })}
      </BottomSheet>

      {/* Decline confirm */}
      <BottomSheet
        visible={sheet?.kind === 'decline'}
        onClose={closeSheet}
        title="Decline this charge?"
        dismissible={!busy}
        error={sheetError}
        footer={
          <>
            <Button
              title="Decline"
              variant="danger"
              loading={busy}
              onPress={() => sheet?.kind === 'decline' && inSheet(() => o.respond(sheet.charge.id, false), closeSheet)}
            />
            <Button title="Cancel" variant="ghost" onPress={closeSheet} />
          </>
        }>
        <ThemedText type="body">{order.creator?.name ?? 'The creator'} will get a notification.</ThemedText>
      </BottomSheet>

      {/* Take over */}
      <BottomSheet
        visible={sheet?.kind === 'adopt'}
        onClose={closeSheet}
        title="Take over this lunch?"
        dismissible={!busy}
        error={sheetError}
        footer={<Button title="Take over" loading={busy} onPress={() => inSheet(o.adopt, closeSheet)} />}>
        <ThemedText type="body">You’ll be able to edit, close or delete it.</ThemedText>
      </BottomSheet>

      {/* Order options (creator), one sheet with swapped content */}
      <BottomSheet
        visible={sheet?.kind === 'options'}
        onClose={closeSheet}
        onBack={optionsView && optionsView !== 'menu' ? toMenu : undefined}
        title={
          {
            menu: 'Order options',
            delivery: 'Who shares delivery',
            charges: 'Extra charges',
            addCharge: 'Add extra charge',
            close: 'Close this lunch?',
            delete: 'Delete this lunch?',
          }[optionsView ?? 'menu']
        }
        dismissible={!busy}
        confirmDiscard={optionsView === 'addCharge' && (charge.label.length > 0 || charge.amount.length > 0)}
        error={sheetError}
        footer={
          optionsView === 'addCharge' ? (
            <Button
              title="Add charge"
              loading={busy}
              onPress={() => {
                const amount = parseAmount(charge.amount);
                if (!charge.for) return setSheetError('Choose who the charge is for.');
                if (!charge.label.trim()) return setSheetError('Say what the charge is for.');
                if (!amount || amount <= 0) return setSheetError('Enter an amount above zero.');
                inSheet(() => o.addCharge(charge.for, charge.label.trim(), amount), () => setSheet({ kind: 'options', view: 'charges' }));
              }}
            />
          ) : optionsView === 'close' ? (
            <Button title="Close lunch" loading={busy} onPress={() => inSheet(o.close, closeSheet)} />
          ) : optionsView === 'delete' ? (
            <Button
              title="Delete lunch"
              variant="danger"
              loading={busy}
              onPress={() =>
                inSheet(o.remove, () => {
                  closeSheet();
                  if (router.canGoBack()) router.back();
                  else router.replace('/');
                })
              }
            />
          ) : undefined
        }>
        {optionsView === 'menu' && (
          <View>
            <ListRow
              title="Edit order"
              leading={<Icon name="edit" color="textSecondary" />}
              chevron
              onPress={() => {
                closeSheet();
                router.push({ pathname: '/order-form', params: { id: order.id } });
              }}
            />
            <ListRow
              title="Who shares delivery"
              subtitle={order.delivery_charge > 0 ? `${payers.length} sharing ${money(order.delivery_charge)}` : 'No delivery fee'}
              leading={<Icon name="delivery" color="textSecondary" />}
              chevron
              onPress={() => setSheet({ kind: 'options', view: 'delivery' })}
            />
            <ListRow
              title="Extra charges"
              subtitle={charges.length ? `${charges.length} added` : 'None yet'}
              leading={<Icon name="money" color="textSecondary" />}
              chevron
              onPress={() => setSheet({ kind: 'options', view: 'charges' })}
            />
            <ListRow
              title="Close order"
              subtitle={closeReasons.length ? closeReasons.join(' · ') : 'Locks the order so nobody can change their picks.'}
              leading={<Icon name="lock" color="textSecondary" />}
              chevron={closeReasons.length === 0}
              onPress={closeReasons.length === 0 ? () => setSheet({ kind: 'options', view: 'close' }) : undefined}
            />
            <ListRow
              title="Delete order"
              destructive
              leading={<Icon name="delete" color="textSecondary" />}
              onPress={() => setSheet({ kind: 'options', view: 'delete' })}
            />
          </View>
        )}
        {optionsView === 'delivery' &&
          (Object.keys(eaten).length === 0 ? (
            <ThemedText type="body" themeColor="textSecondary">
              Nobody has picked anything yet.
            </ThemedText>
          ) : (
            <>
            {noPayers && (
              <ThemedText type="small" themeColor="warningText">
                Nobody shares the {money(order.delivery_charge)} delivery fee. Add someone before closing the order.
              </ThemedText>
            )}
            {Object.keys(eaten)
              .sort((a, b) => label(a).localeCompare(label(b)))
              .map((m) => (
                <ListRow
                  key={m}
                  title={label(m)}
                  subtitle={excluded.has(m) ? 'Doesn’t share delivery' : 'Shares delivery'}
                  trailing={
                    <Button
                      title={excluded.has(m) ? 'Add' : 'Skip'}
                      variant="secondary"
                      size="sm"
                      disabled={busy}
                      onPress={() => inSheet(() => o.toggleDelivery(m, excluded.has(m)))}
                    />
                  }
                />
              ))}
            </>
          ))}
        {optionsView === 'charges' && (
          <>
            {charges.length === 0 && (
              <ThemedText type="body" themeColor="textSecondary">
                No extra charges.
              </ThemedText>
            )}
            {charges.map((c) => (
              <ListRow
                key={c.id}
                title={`${c.label} · ${money(c.amount)}`}
                subtitle={`${label(c.member_id)} · ${CHARGE_STATUS[c.status]}`}
                trailing={
                  <IconButton icon="close" label={`Remove ${c.label}`} disabled={busy} onPress={() => inSheet(() => o.removeCharge(c.id))} />
                }
              />
            ))}
            <Button title="Add extra charge" icon="add" variant="secondary" onPress={openAddCharge} />
          </>
        )}
        {optionsView === 'addCharge' && (
          <>
            <ThemedText type="bodyStrong">For</ThemedText>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm }}>
              {team.map((t) => (
                <Button
                  key={t.id}
                  title={t.id === me ? 'You' : t.name}
                  variant={charge.for === t.id ? 'secondary' : 'ghost'}
                  size="sm"
                  icon={charge.for === t.id ? 'check' : undefined}
                  onPress={() => editCharge({ for: t.id })}
                />
              ))}
            </View>
            <Input label="What for?" placeholder="e.g. Extra raita" value={charge.label} onChangeText={(v) => editCharge({ label: v })} />
            <Input
              label="Amount (Rs)"
              placeholder="0"
              keyboardType="decimal-pad"
              value={charge.amount}
              onChangeText={(v) => editCharge({ amount: v })}
              hint="They get a notification and have to accept it."
            />
          </>
        )}
        {optionsView === 'close' && (
          <ThemedText type="body">Picks, prices and charges will be locked.</ThemedText>
        )}
        {optionsView === 'delete' && (
          <ThemedText type="body">All items, picks and charges on it are removed.</ThemedText>
        )}
      </BottomSheet>
    </>
  );
}
