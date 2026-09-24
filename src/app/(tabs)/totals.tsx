import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import {
  BottomSheet,
  Button,
  Card,
  Divider,
  EmptyState,
  ErrorState,
  ListRow,
  Row,
  Screen,
  SectionHeader,
  Skeleton,
  StatusBadge,
  useToast,
} from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useBilling, type Cycle, type Lunch, type TeamRow } from '@/features/billing/use-billing';
import { normalizeTitle } from '@/features/orders/restaurants';
import type { FriendlyError } from '@/lib/errors';
import { dayLabel, money, rangeLabel, splitRound } from '@/lib/format';

export { RouteErrorBoundary as ErrorBoundary } from '@/components/ui';

type Sheet =
  | null
  | { kind: 'review' }
  | { kind: 'finish' }
  | { kind: 'everyone'; title: string; rows: TeamRow[]; back?: { kind: 'past'; cycle: Cycle } }
  | { kind: 'past'; cycle: Cycle };

/** Restaurant rows: my amounts grouped by normalised title. */
function byRestaurant(lunches: Lunch[]) {
  const groups = new Map<string, { title: string; count: number; amount: number }>();
  for (const l of lunches) {
    const key = normalizeTitle(l.title) || 'lunch';
    const g = groups.get(key) ?? { title: l.title.trim() || 'Lunch', count: 0, amount: 0 };
    g.count++;
    g.amount += l.amount;
    groups.set(key, g);
  }
  return [...groups.values()].sort((a, b) => b.amount - a.amount);
}

const periodLabel = (lunches: { ordered_on: string }[], fallback: string) => {
  if (!lunches.length) return rangeLabel(fallback);
  const days = lunches.map((l) => l.ordered_on).sort();
  return rangeLabel(days[0], days[days.length - 1]);
};

export default function MyLunchesScreen() {
  const router = useRouter();
  const toast = useToast();
  const b = useBilling();
  const [sheet, setSheet] = useState<Sheet>(null);
  const [busy, setBusy] = useState(false);
  const [sheetError, setSheetError] = useState<string | null>(null);

  const closeSheet = () => {
    setSheet(null);
    setSheetError(null);
  };
  async function act(action: () => Promise<FriendlyError | null>, success?: string) {
    setBusy(true);
    const err = await action();
    setBusy(false);
    if (err) return sheet ? setSheetError(err.message) : toast.show(err.message);
    closeSheet();
    if (success) toast.show(success);
  }

  if (!b.state) {
    return (
      <Screen>
        <ThemedText type="screenTitle">My Lunches</ThemedText>
        {b.error ? <ErrorState message={b.error.message} onRetry={b.reload} /> : <Skeleton.Card />}
      </Screen>
    );
  }

  const { cycle, team, myLunches, cycleOf, history, myHistory, untallied, openOrders } = b.state;
  const me = b.me;
  const mine = myLunches.filter((l) => l.amount > 0);
  const outside = mine.filter((l) => !cycleOf[l.order_id]);
  const inCycle = cycle ? myLunches.filter((l) => cycleOf[l.order_id] === cycle.id) : [];
  const myInCycle = inCycle.filter((l) => l.amount > 0);
  const myRow = team.find((t) => t.member_id === me);
  const myTotal = myRow?.grand_total ?? 0;
  const confirmed = !!myRow?.confirmed_at;
  const participants = team.filter((t) => t.grand_total > 0 && t.is_member);
  const confirmedCount = participants.filter((t) => t.confirmed_at).length;
  const starterHere = !!cycle?.triggered_by && team.some((t) => t.member_id === cycle.triggered_by && t.is_member);
  const canSeeFinish = !!cycle && (cycle.triggered_by === me || !starterHere);
  const allConfirmed = confirmedCount === participants.length;
  const outsideTotal = outside.reduce((s, l) => s + l.amount, 0);
  const current = cycle ? myInCycle : outside;
  const nothing = !cycle && mine.length === 0 && history.length === 0;

  const everyone = (title: string, rows: TeamRow[], back?: { kind: 'past'; cycle: Cycle }) =>
    setSheet({ kind: 'everyone', title, back, rows: [...rows].sort((a, c) => (a.member_id === me ? -1 : c.member_id === me ? 1 : a.member_name.localeCompare(c.member_name))) });

  return (
    <Screen refreshing={false} onRefresh={b.reload}>
      <ThemedText type="screenTitle">My Lunches</ThemedText>

      {nothing ? (
        <EmptyState emoji="🍽️" title="No lunches yet" text="Your lunch spending will appear here." />
      ) : (
        <Card tone="purple">
          <ThemedText type="caption" themeColor="accentText">
            {cycle ? `In review · ${periodLabel(inCycle, cycle.created_at)}` : 'Since your last review'}
          </ThemedText>
          <ThemedText type="amountLarge">{money(cycle ? myTotal : outsideTotal)}</ThemedText>
          <ThemedText type="body">Your total</ThemedText>
          <ThemedText type="small" themeColor="accentText">
            {current.length} lunch{current.length === 1 ? '' : 'es'}
          </ThemedText>
          {cycle && myTotal > 0 && !confirmed && <Button title="Review lunches" onPress={() => setSheet({ kind: 'review' })} />}
          {cycle && myTotal > 0 && confirmed && <StatusBadge status="confirmed" />}
          {cycle && myTotal === 0 && (
            <ThemedText type="small" themeColor="accentText">
              You weren’t in this review.
            </ThemedText>
          )}
        </Card>
      )}

      {cycle && outsideTotal > 0 && (
        <Card>
          <Row>
            <ThemedText type="bodyStrong">Not in a review yet</ThemedText>
            <ThemedText type="amount">{money(outsideTotal)}</ThemedText>
          </Row>
          <ThemedText type="small" themeColor="textSecondary">
            {outside.length} lunch{outside.length === 1 ? '' : 'es'} · they go into the next review
          </ThemedText>
        </Card>
      )}

      {current.length > 0 && (
        <>
          <SectionHeader title={cycle ? 'This review' : 'Your lunches'} />
          <Card style={{ gap: 0, paddingVertical: Spacing.xs }}>
            {byRestaurant(current).map((r, i) => (
              <View key={r.title}>
                {i > 0 && <Divider />}
                <ListRow title={r.title} subtitle={`${r.count} lunch${r.count === 1 ? '' : 'es'}`} value={money(r.amount)} />
              </View>
            ))}
          </Card>
        </>
      )}

      {!cycle && untallied > 0 && (
        <Card tone="mint">
          <ThemedText type="bodyStrong">
            {untallied} lunch{untallied === 1 ? '' : 'es'} ready for review
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Everyone will be asked to confirm their total.
          </ThemedText>
          <Button title="Start a review" loading={busy} onPress={() => act(b.start, 'Review started')} />
        </Card>
      )}

      {cycle && (
        <Card>
          <Row>
            <ThemedText type="bodyStrong">
              {confirmedCount} of {participants.length} confirmed
            </ThemedText>
            <StatusBadge status={allConfirmed ? 'ready' : 'waiting'} label={allConfirmed ? 'Ready' : 'Waiting'} />
          </Row>
          {openOrders > 0 && (
            <ThemedText type="small" themeColor="textSecondary">
              {openOrders} open lunch{openOrders === 1 ? '' : 'es'} will go into the next review.
            </ThemedText>
          )}
          <Button title="See everyone’s totals" variant="secondary" onPress={() => everyone('Everyone’s totals', team)} />
          {canSeeFinish && (
            <Button
              title="Finish review"
              disabled={!allConfirmed}
              loading={busy}
              onPress={() => (openOrders > 0 ? setSheet({ kind: 'finish' }) : act(() => b.finish(cycle.id), 'Review finished'))}
            />
          )}
        </Card>
      )}

      {history.length > 0 && (
        <>
          <SectionHeader title="Past reviews" />
          <Card style={{ gap: 0, paddingVertical: Spacing.xs }}>
            {history.map((c, i) => {
              const lunches = myLunches.filter((l) => cycleOf[l.order_id] === c.id);
              const total = myHistory[c.id] ?? 0;
              return (
                <View key={c.id}>
                  {i > 0 && <Divider />}
                  <ListRow
                    title={periodLabel(lunches, c.created_at)}
                    subtitle={total > 0 ? undefined : 'You weren’t in this one'}
                    value={money(total)}
                    chevron
                    onPress={() => setSheet({ kind: 'past', cycle: c })}
                  />
                </View>
              );
            })}
          </Card>
          {b.hasMore && <Button title="Show older" variant="ghost" onPress={b.showOlder} />}
        </>
      )}

      {/* Review my lunches → confirm */}
      <BottomSheet
        visible={sheet?.kind === 'review'}
        onClose={closeSheet}
        title="Review lunches"
        dismissible={!busy}
        error={sheetError}
        footer={cycle && <Button title="Confirm" loading={busy} onPress={() => act(() => b.confirm(cycle.id), 'Total confirmed')} />}>
        {myInCycle.map((l) => (
          <ListRow
            key={l.order_id}
            title={l.title || 'Lunch'}
            subtitle={`${dayLabel(l.ordered_on)} · by ${l.created_by === me ? 'you' : (l.creator ?? 'Former member')}`}
            value={money(l.amount)}
          />
        ))}
        <Divider />
        <Row>
          <ThemedText type="bodyStrong">Your total</ThemedText>
          <ThemedText type="amount">{money(myTotal)}</ThemedText>
        </Row>
        <ThemedText type="sectionTitle">Everything looks right?</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Something’s wrong? Ask the person who created that lunch.
        </ThemedText>
      </BottomSheet>

      {/* Finish with open orders */}
      <BottomSheet
        visible={sheet?.kind === 'finish'}
        onClose={closeSheet}
        title="Finish this review?"
        dismissible={!busy}
        error={sheetError}
        footer={
          cycle && (
            <>
              <Button title="Finish anyway" loading={busy} onPress={() => act(() => b.finish(cycle.id), 'Review finished')} />
              <Button
                title="Go to orders"
                variant="ghost"
                onPress={() => {
                  closeSheet();
                  router.navigate('/');
                }}
              />
            </>
          )
        }>
        <ThemedText type="body">
          {openOrders} lunch{openOrders === 1 ? ' is' : 'es are'} still open. They’ll go into the next review.
        </ThemedText>
      </BottomSheet>

      {/* Everyone's totals */}
      <BottomSheet
        visible={sheet?.kind === 'everyone'}
        onClose={closeSheet}
        onBack={sheet?.kind === 'everyone' && sheet.back ? () => setSheet(sheet.back!) : undefined}
        title={sheet?.kind === 'everyone' ? sheet.title : ''}>
        {sheet?.kind === 'everyone' &&
          sheet.rows.map((t) => {
            const [f, d, x] = splitRound([Number(t.items_total), Number(t.delivery_total), Number(t.extras_total)], t.grand_total);
            return (
              <View key={t.member_id} style={{ gap: Spacing.xs, opacity: t.is_member ? 1 : 0.7 }}>
                <Row>
                  <ThemedText type="bodyStrong" numberOfLines={1} style={{ flexShrink: 1 }}>
                    {t.member_id === me ? 'You' : t.member_name}
                  </ThemedText>
                  <ThemedText type="amount">{money(t.grand_total)}</ThemedText>
                </Row>
                <ThemedText type="caption" themeColor="textSecondary">
                  Food {money(f)} · Delivery {money(d)} · Extras {money(x)}
                  {t.is_member ? '' : ' · Left the team'}
                </ThemedText>
                {t.grand_total > 0 && (
                  <StatusBadge status={t.confirmed_at ? 'confirmed' : 'waiting'} label={t.confirmed_at ? 'Confirmed' : 'Waiting'} />
                )}
                <Divider />
              </View>
            );
          })}
      </BottomSheet>

      {/* Past review detail */}
      <BottomSheet visible={sheet?.kind === 'past'} onClose={closeSheet} title="Past review">
        {sheet?.kind === 'past' &&
          (() => {
            const c = sheet.cycle;
            const all = myLunches.filter((l) => cycleOf[l.order_id] === c.id);
            const my = all.filter((l) => l.amount > 0);
            return (
              <>
                <ThemedText type="caption" themeColor="textSecondary">
                  {periodLabel(all, c.created_at)}
                </ThemedText>
                <Row>
                  <ThemedText type="bodyStrong">Your total</ThemedText>
                  <ThemedText type="amount">{money(myHistory[c.id] ?? 0)}</ThemedText>
                </Row>
                <ThemedText type="small" themeColor="textSecondary">
                  You had {my.length} of the team’s {all.length} lunch{all.length === 1 ? '' : 'es'}
                </ThemedText>
                {byRestaurant(my).map((r) => (
                  <ListRow key={r.title} title={r.title} subtitle={`${r.count} lunch${r.count === 1 ? '' : 'es'}`} value={money(r.amount)} />
                ))}
                <Button title="See everyone’s totals" variant="secondary" onPress={async () => everyone('Everyone’s totals', await b.teamFor(c.id), { kind: 'past', cycle: c })} />
              </>
            );
          })()}
      </BottomSheet>
    </Screen>
  );
}
