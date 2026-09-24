import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, Card, Divider, EmptyState, ErrorState, Icon, ListRow, Row, Screen, SectionHeader, Skeleton, StatusBadge } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { badge, facts, pickHero } from '@/features/orders/classify';
import { useOrders } from '@/features/orders/use-orders';
import { dayLabel, greeting, money } from '@/lib/format';
import { useSession } from '@/lib/session';

export { RouteErrorBoundary as ErrorBoundary } from '@/components/ui';

export default function OrdersScreen() {
  const router = useRouter();
  const member = useSession().member!;
  const { me, orders, inReview, myAmounts, review, error, refreshing, refresh } = useOrders();
  const open = (id: string) => router.push({ pathname: '/order/[id]', params: { id } });
  const startOrder = () => router.push('/order-form');

  const header = (
    <Row style={{ alignItems: 'flex-start' }}>
      <View style={{ flexShrink: 1, gap: 2 }}>
        <ThemedText type="small" themeColor="textSecondary">
          {greeting()},
        </ThemedText>
        <ThemedText type="screenTitle" numberOfLines={1}>
          {member.name.split(' ')[0]} 👋
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
          {member.teams.name}
        </ThemedText>
      </View>
      <Button title="New lunch" icon="add" variant="secondary" size="sm" onPress={startOrder} />
    </Row>
  );

  if (!orders) {
    return (
      <Screen>
        {header}
        {error ? (
          <ErrorState message={error.message} onRetry={refresh} />
        ) : (
          <>
            <Skeleton.Card />
            <Skeleton.Row />
            <Skeleton.Row />
          </>
        )}
      </Screen>
    );
  }

  const hero = pickHero(orders, me, review);
  const heroId = hero && hero.kind !== 'review' ? hero.order.id : null;
  const rest = orders.filter((o) => o.id !== heroId);

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      {header}

      {hero?.kind === 'attention' && (
        <Card tone="warning" onPress={() => open(hero.order.id)} accessibilityLabel={`${hero.order.title || 'Lunch'}: extra charge needs your answer`}>
          <StatusBadge status="attention" />
          <ThemedText type="sectionTitle" numberOfLines={1}>
            {hero.order.title || 'Lunch'}
          </ThemedText>
          <ThemedText type="body">Extra charge {money(hero.amount)} needs your answer</ThemedText>
          <ThemedText type="bodyStrong" themeColor="warningText">
            Review it →
          </ThemedText>
        </Card>
      )}

      {hero?.kind === 'review' && (
        <Card tone="purple" onPress={() => router.navigate('/totals')} accessibilityLabel={`Review lunches. Your total ${money(hero.total)}`}>
          <ThemedText type="caption" themeColor="accentText">
            Review lunches
          </ThemedText>
          <ThemedText type="amountLarge">{money(hero.total)}</ThemedText>
          <ThemedText type="body">Your total</ThemedText>
          <ThemedText type="bodyStrong" themeColor="accentText">
            Confirm →
          </ThemedText>
        </Card>
      )}

      {hero?.kind === 'lunch' &&
        (() => {
          const f = facts(hero.order, me);
          const b = badge(hero.order, me);
          return (
            <Card tone="mint" onPress={() => open(hero.order.id)} accessibilityLabel={`${hero.label}: ${hero.order.title || 'Lunch'}`}>
              <ThemedText type="caption" themeColor="primaryText">
                {hero.label}
              </ThemedText>
              <Row>
                <ThemedText type="sectionTitle" numberOfLines={1} style={{ flexShrink: 1 }}>
                  {hero.order.title || 'Lunch'}
                </ThemedText>
                <StatusBadge status={b.status} label={b.label} />
              </Row>
              <ThemedText type="small" themeColor="textSecondary">
                {f.qty} item{f.qty === 1 ? '' : 's'} · {money(f.total)}
              </ThemedText>
              {f.myUnits > 0 ? (
                <>
                  <ThemedText type="body">
                    You’re having {f.myUnits} item{f.myUnits === 1 ? '' : 's'} · {money(myAmounts[hero.order.id] ?? 0)}
                  </ThemedText>
                  <ThemedText type="bodyStrong" themeColor="primaryText">
                    Change →
                  </ThemedText>
                </>
              ) : (
                <>
                  <ThemedText type="body">Your order is waiting!</ThemedText>
                  <ThemedText type="bodyStrong" themeColor="primaryText">
                    Choose your items →
                  </ThemedText>
                </>
              )}
            </Card>
          );
        })()}

      {orders.length === 0 && (
        <EmptyState emoji="🍔" title="No orders yet" text="Get the team started with a lunch order." action={{ label: 'Start an order', onPress: startOrder }} />
      )}

      {rest.length > 0 && (
        <>
          <SectionHeader title="Lunches" />
          <Card style={{ gap: 0, paddingVertical: Spacing.xs }}>
            {rest.map((o, i) => {
              const b = badge(o, me);
              const by = o.created_by === me ? 'you' : (o.creator?.name ?? 'Former member');
              const mine = myAmounts[o.id];
              const note = o.status === 'closed' ? (inReview.has(o.id) ? 'In the current review' : 'Goes into the next review') : null;
              const subtitle = [dayLabel(o.ordered_on), `by ${by}`, mine ? `You: ${money(mine)}` : null, note].filter(Boolean).join(' · ');
              return (
                <View key={o.id}>
                  {i > 0 && <Divider />}
                  <ListRow
                    leading={<Icon name={o.status === 'closed' ? 'lock' : 'food'} color="textSecondary" />}
                    title={o.title || 'Lunch'}
                    subtitle={subtitle}
                    value={money(facts(o, me).total)}
                    trailing={<StatusBadge status={b.status} label={b.label} />}
                    onPress={() => open(o.id)}
                  />
                </View>
              );
            })}
          </Card>
        </>
      )}
    </Screen>
  );
}
