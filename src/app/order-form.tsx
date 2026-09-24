import { Stack, useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { useEffect, useState } from 'react';
import { BackHandler, View } from 'react-native';

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
  Input,
  ListRow,
  QuantityStepper,
  Row,
  Screen,
  SectionHeader,
  Skeleton,
  useToast,
} from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { buildSuggestions, filterSuggestions, type Suggestion } from '@/features/orders/restaurants';
import { useOrderDraft, type DraftItem } from '@/features/orders/use-order-draft';
import { dayLabel, money, parseAmount, shortDate, ymd } from '@/lib/format';
import { supabase } from '@/lib/supabase';

export { RouteErrorBoundary as ErrorBoundary } from '@/components/ui';

type Step = 'restaurant' | 'items' | 'review';

const addDays = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return ymd(d);
};

export default function OrderFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const navigation = useNavigation();
  const toast = useToast();
  const d = useOrderDraft(id);

  const [step, setStep] = useState<Step>(id ? 'items' : 'restaurant');
  const [search, setSearch] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [editing, setEditing] = useState<{ key: string; original?: DraftItem } | null>(null);
  const [itemError, setItemError] = useState<string | null>(null);
  const [dateSheet, setDateSheet] = useState(false);
  const [confirmRemoved, setConfirmRemoved] = useState<string[] | null>(null);
  const [discard, setDiscard] = useState<null | (() => void)>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<null | { go: () => void }>(null);

  useEffect(() => {
    if (id) return;
    supabase
      .from('orders')
      .select('title, ordered_on')
      .neq('title', '')
      .order('created_at', { ascending: false })
      .limit(300)
      .then(({ data }) => setSuggestions(buildSuggestions(data ?? [])));
  }, [id]);

  // Unsaved-changes guard. The guard reads the last committed render, so navigation after a save
  // happens in the effect below, once `saved` has turned the guard off.
  usePreventRemove(d.dirty && !saved && !saving, ({ data }) => setDiscard(() => () => navigation.dispatch(data.action)));
  useEffect(() => {
    saved?.go();
  }, [saved]);

  // Android back steps back through the flow before leaving it.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (step === 'review') return setStep('items'), true;
      if (step === 'items' && !id) return setStep('restaurant'), true;
      return false;
    });
    return () => sub.remove();
  }, [step, id]);

  function choose(title: string) {
    d.setTitle(title);
    setStep('items');
  }

  function openItem(row?: DraftItem) {
    setItemError(null);
    if (row) setEditing({ key: row.key, original: row });
    else setEditing({ key: d.addItem() });
  }

  function cancelItem() {
    if (!editing) return;
    if (editing.original) d.replaceItem(editing.original);
    else d.removeItem(editing.key);
    setEditing(null);
  }

  function saveItem(row: DraftItem) {
    if (!row.name.trim()) return setItemError('Give the item a name.');
    if (parseAmount(row.price) === null) return setItemError('Enter a price, like 450.');
    d.lookupNow(row.key);
    setEditing(null);
    setError(null); // an edited item may fix what the last submit complained about
  }

  async function submit(confirmed = false) {
    const invalid = d.validate();
    if (invalid) return setError(invalid);
    setError(null);
    setSaving(true);
    if (id && !confirmed) {
      const check = await d.checkEdit();
      const problem = check.error?.message ?? check.belowPicked;
      if (problem || check.removedPicked.length) {
        setSaving(false);
        if (problem) return setError(problem);
        return setConfirmRemoved(check.removedPicked);
      }
    }
    const result = await d.save();
    if (result.error) {
      setSaving(false);
      return setError(result.error.message);
    }
    setSaved({
      go: id
        ? () => {
            toast.show('Saved');
            router.back();
          }
        : () => router.replace({ pathname: '/order-confirmed', params: { id: result.orderId! } }),
    });
  }

  const title = id ? 'Edit lunch' : 'New lunch';
  const editingRow = editing ? d.items.find((r) => r.key === editing.key) : undefined;
  const lineTotal = (r: DraftItem) => (parseAmount(r.price) ?? 0) * r.qty;
  const itemsTotal = d.items.reduce((s, r) => s + lineTotal(r), 0);
  const deliveryFee = parseAmount(d.delivery) ?? 0;
  const lookingUp = d.items.some((r) => r.loading);

  if (!d.loaded) {
    return (
      <>
        <Stack.Screen options={{ title }} />
        <Screen nativeHeader>
          {d.loadError ? (
            <ErrorState message={d.loadError.message} onRetry={() => router.back()} />
          ) : (
            <>
              <Skeleton height={28} width="60%" />
              <Skeleton.Row />
              <Skeleton.Row />
            </>
          )}
        </Screen>
      </>
    );
  }

  const { useTyped, list } = filterSuggestions(suggestions, search);
  const dateOptions = [...new Set([d.date, ...Array.from({ length: 91 }, (_, i) => addDays(30 - i))])].sort().reverse();
  const today = addDays(0);
  const tomorrow = addDays(1);

  return (
    <>
      <Stack.Screen options={{ title }} />

      {step === 'restaurant' && (
        <Screen nativeHeader keyboard>
          <ThemedText type="screenTitle">What are we ordering?</ThemedText>
          <Input
            placeholder="Search or type a restaurant…"
            value={search}
            onChangeText={setSearch}
            maxLength={80}
            autoCorrect={false}
            autoCapitalize="words"
            autoFocus={!id}
            returnKeyType="next"
            onSubmitEditing={() => search.trim() && choose(useTyped ?? search.trim())}
            accessibilityLabel="Restaurant"
          />
          {(useTyped || list.length > 0) && (
            <Card style={{ gap: 0, paddingVertical: Spacing.xs }}>
              {useTyped && (
                <ListRow title={`Use “${useTyped}”`} leading={<Icon name="add" color="primaryText" />} onPress={() => choose(useTyped)} />
              )}
              {list.map((s) => (
                <ListRow
                  key={s.title}
                  title={s.title}
                  subtitle={`Last ordered ${dayLabel(s.lastOrderedOn)}`}
                  leading={<Icon name="food" color="textSecondary" />}
                  chevron
                  onPress={() => choose(s.title)}
                />
              ))}
            </Card>
          )}
          {!useTyped && list.length === 0 && (
            <ThemedText type="small" themeColor="textSecondary">
              Type a restaurant name to start.
            </ThemedText>
          )}
          <Button title={id ? 'Keep current name' : 'Skip'} variant="ghost" onPress={() => (id ? setStep('items') : choose(''))} />
        </Screen>
      )}

      {step === 'items' && (
        <Screen
          nativeHeader
          footer={
            <>
              {error && (
                <ThemedText type="small" themeColor="danger" accessibilityLiveRegion="polite">
                  {error}
                </ThemedText>
              )}
              <Button
                title="Continue"
                disabled={!d.items.length}
                onPress={() => {
                  const invalid = d.validate();
                  if (invalid) return setError(invalid);
                  setError(null);
                  setStep('review');
                }}
              />
            </>
          }>
          <ListRow
            title={d.title || 'Lunch'}
            subtitle="Restaurant · tap to change"
            leading={<Icon name="food" color="primaryText" />}
            onPress={() => setStep('restaurant')}
          />
          <ThemedText type="screenTitle">What are we having?</ThemedText>
          {d.items.length === 0 ? (
            <EmptyState icon="food" title="No items yet" text="Add what the team is ordering." />
          ) : (
            <Card style={{ gap: 0, paddingVertical: Spacing.xs }}>
              {d.items.map((r, i) => (
                <View key={r.key}>
                  {i > 0 && <Divider />}
                  <ListRow
                    leading={<FoodThumb uri={r.url} loading={r.loading} />}
                    title={r.name || 'Unnamed item'}
                    subtitle={`${money(parseAmount(r.price) ?? 0)} × ${r.qty}`}
                    value={money(lineTotal(r))}
                    onPress={() => openItem(r)}
                  />
                </View>
              ))}
            </Card>
          )}
          <Button title="Add item" icon="add" variant="secondary" onPress={() => openItem()} />
        </Screen>
      )}

      {step === 'review' && (
        <Screen
          nativeHeader
          keyboard
          footer={
            <>
              {error && (
                <ThemedText type="small" themeColor="danger" accessibilityLiveRegion="polite">
                  {error}
                </ThemedText>
              )}
              {saving && lookingUp && (
                <ThemedText type="small" themeColor="textSecondary">
                  Finding pictures…
                </ThemedText>
              )}
              <Button title={id ? 'Save changes' : 'Create order'} loading={saving} onPress={() => submit()} />
            </>
          }>
          <ListRow
            title={d.title || 'Lunch'}
            subtitle="Restaurant · tap to change"
            leading={<Icon name="food" color="primaryText" />}
            onPress={() => setStep('restaurant')}
          />
          <SectionHeader title="When" />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm }}>
            <Button title="Today" size="sm" variant={d.date === today ? 'secondary' : 'ghost'} icon={d.date === today ? 'check' : undefined} onPress={() => d.setDate(today)} />
            <Button title="Tomorrow" size="sm" variant={d.date === tomorrow ? 'secondary' : 'ghost'} icon={d.date === tomorrow ? 'check' : undefined} onPress={() => d.setDate(tomorrow)} />
            <Button
              title={d.date !== today && d.date !== tomorrow ? shortDate(d.date) : 'Other…'}
              size="sm"
              variant={d.date !== today && d.date !== tomorrow ? 'secondary' : 'ghost'}
              icon="calendar"
              onPress={() => setDateSheet(true)}
            />
          </View>
          <Input
            label="Delivery fee (Rs)"
            placeholder="0"
            keyboardType="decimal-pad"
            value={d.delivery}
            onChangeText={d.setDelivery}
            hint="Split evenly between everyone who picks something."
          />
          <SectionHeader title="Items" />
          <Card style={{ gap: Spacing.sm }}>
            {d.items.map((r) => (
              <Row key={r.key}>
                <ThemedText type="body" numberOfLines={1} style={{ flexShrink: 1 }}>
                  {r.name} × {r.qty}
                </ThemedText>
                <ThemedText type="amount">{money(lineTotal(r))}</ThemedText>
              </Row>
            ))}
            {deliveryFee > 0 && (
              <Row>
                <ThemedText type="body" themeColor="textSecondary">Delivery</ThemedText>
                <ThemedText type="amount">{money(deliveryFee)}</ThemedText>
              </Row>
            )}
            <Divider />
            <Row>
              <ThemedText type="bodyStrong">Total bill</ThemedText>
              <ThemedText type="amount">{money(itemsTotal + deliveryFee)}</ThemedText>
            </Row>
          </Card>
        </Screen>
      )}

      {/* Item editor */}
      <BottomSheet
        visible={!!editingRow}
        onClose={cancelItem}
        title={editing?.original ? 'Edit item' : 'Add item'}
        error={itemError}
        footer={
          editingRow && (
            <>
              <Button title="Save item" onPress={() => saveItem(editingRow)} />
              {editing?.original && (
                <Button
                  title="Remove item"
                  variant="danger"
                  onPress={() => {
                    d.removeItem(editingRow.key);
                    setEditing(null);
                    setError(null);
                  }}
                />
              )}
            </>
          )
        }>
        {editingRow && (
          <>
            <Row style={{ justifyContent: 'flex-start' }}>
              <FoodThumb uri={editingRow.url} loading={editingRow.loading} />
              <ThemedText type="small" themeColor="textSecondary" style={{ flexShrink: 1 }}>
                We find a picture from the name.
              </ThemedText>
            </Row>
            <Input label="Name" value={editingRow.name} onChangeText={(v) => { d.setItemName(editingRow.key, v); setItemError(null); }} autoFocus autoCorrect={false} autoCapitalize="words" placeholder="e.g. Zinger Burger" />
            <Input
              label="Price (Rs)"
              value={editingRow.price}
              onChangeText={(v) => { d.update(editingRow.key, { price: v }); setItemError(null); }}
              keyboardType="decimal-pad"
              placeholder="0"
            />
            <Row>
              <ThemedText type="bodyStrong">Quantity</ThemedText>
              <QuantityStepper value={editingRow.qty} min={1} onChange={(v) => d.update(editingRow.key, { qty: v })} itemName={editingRow.name || 'item'} />
            </Row>
          </>
        )}
      </BottomSheet>

      {/* Date list */}
      <BottomSheet visible={dateSheet} onClose={() => setDateSheet(false)} title="Pick a date">
        {dateOptions.map((day) => (
          <ListRow
            key={day}
            title={dayLabel(day)}
            subtitle={day === d.date ? 'Selected' : undefined}
            trailing={day === d.date ? <Icon name="check" color="primaryText" /> : undefined}
            onPress={() => {
              d.setDate(day);
              setDateSheet(false);
            }}
          />
        ))}
      </BottomSheet>

      {/* Removing items teammates picked */}
      <BottomSheet
        visible={!!confirmRemoved}
        onClose={() => setConfirmRemoved(null)}
        title="Remove picked items?"
        footer={
          <>
            <Button
              title="Remove anyway"
              variant="danger"
              onPress={() => {
                setConfirmRemoved(null);
                submit(true);
              }}
            />
            <Button title="Keep them" variant="ghost" onPress={() => setConfirmRemoved(null)} />
          </>
        }>
        {confirmRemoved?.map((line) => (
          <ThemedText key={line} type="body">
            {line}.
          </ThemedText>
        ))}
        <ThemedText type="small" themeColor="textSecondary">
          Those picks will be removed.
        </ThemedText>
      </BottomSheet>

      {/* Leaving with unsaved changes */}
      <BottomSheet
        visible={!!discard}
        onClose={() => setDiscard(null)}
        title={id ? 'Discard your changes?' : 'Discard this lunch?'}
        footer={
          <>
            <Button
              title="Discard"
              variant="danger"
              onPress={() => {
                const leave = discard;
                setDiscard(null);
                leave?.();
              }}
            />
            <Button title="Keep editing" variant="ghost" onPress={() => setDiscard(null)} />
          </>
        }>
        <ThemedText type="body">What you’ve entered won’t be saved.</ThemedText>
      </BottomSheet>
    </>
  );
}

