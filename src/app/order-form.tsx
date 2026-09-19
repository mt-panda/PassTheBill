import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import {
  Button,
  Card,
  Divider,
  IconButton,
  Input,
  Row,
  Stepper,
  styles,
} from '@/components/ui';
import { CURRENCY, money, useSession, ymd } from '@/lib/session';
import { supabase } from '@/lib/supabase';

type Draft = {
  key: string;
  id?: string;
  name: string;
  price: string;
  qty: string;
  image_url?: string | null;
  image_loading?: boolean;
};

type ImageLookupResult = {
  name: string;
  search_query: string;
  image_url: string | null;
  image_page_url: string | null;
  photographer: string | null;
  photographer_url: string | null;
  alt: string | null;
  pexels_id: number | null;
};

const blank = (): Draft => ({
  key: String(Math.random()),
  name: '',
  price: '',
  qty: '1',
  image_url: null,
  image_loading: false,
});

const IMAGE_LOOKUP_DELAY = 5000;

export default function OrderFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const member = useSession().member!;

  const [title, setTitle] = useState('');
  const [date, setDate] = useState(ymd(new Date()));
  const [delivery, setDelivery] = useState('');
  const [items, setItems] = useState<Draft[]>([blank()]);
  const [originalIds, setOriginalIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const imageTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );

  const imageRequestIds = useRef<Map<string, number>>(new Map());

  const imageCache = useRef<Map<string, ImageLookupResult | null>>(
    new Map(),
  );

  useEffect(() => {
    if (!id) return;

    supabase
      .from('orders')
      .select(
        'title, ordered_on, delivery_charge, order_items(id, name, unit_price, qty, image_url)',
      )
      .eq('id', id)
      .single()
      .then(({ data, error }) => {
        if (error) {
          Alert.alert('Could not load order', error.message);
          return;
        }

        setTitle(data.title);
        setDate(data.ordered_on);
        setDelivery(String(data.delivery_charge));

        const rows = data.order_items as {
          id: string;
          name: string;
          unit_price: number;
          qty: number;
          image_url: string | null;
        }[];

        setItems(
          rows.map((item) => ({
            key: item.id,
            id: item.id,
            name: item.name,
            price: String(item.unit_price),
            qty: String(item.qty),
            image_url: item.image_url ?? null,
            image_loading: false,
          })),
        );

        setOriginalIds(rows.map((item) => item.id));
      });
  }, [id]);

  useEffect(() => {
    return () => {
      imageTimers.current.forEach((timer) => clearTimeout(timer));
      imageTimers.current.clear();
    };
  }, []);

  const update = (key: string, patch: Partial<Draft>) =>
    setItems((rows) =>
      rows.map((row) =>
        row.key === key ? { ...row, ...patch } : row,
      ),
    );

  async function lookupImage(key: string, name: string) {
    const cleanName = name.trim();

    if (!cleanName) {
      update(key, {
        image_url: null,
        image_loading: false,
      });
      return;
    }

    const requestId =
      (imageRequestIds.current.get(key) ?? 0) + 1;

    imageRequestIds.current.set(key, requestId);

    const cached = imageCache.current.get(
      cleanName.toLowerCase(),
    );

    if (cached !== undefined) {
      update(key, {
        image_url: cached?.image_url ?? null,
        image_loading: false,
      });
      return;
    }

    update(key, {
      image_loading: true,
    });

    try {
      const { data, error } = await supabase.functions.invoke(
        'food-image',
        {
          body: {
            items: [cleanName],
          },
        },
      );

      if (
        imageRequestIds.current.get(key) !==
        requestId
      ) {
        return;
      }

      if (error) {
        console.warn('IMAGE FUNCTION ERROR:', error);
        console.warn('IMAGE FUNCTION ERROR NAME:', error.name);
        console.warn(
          'IMAGE FUNCTION ERROR MESSAGE:',
          error.message,
        );
        console.warn(
          'IMAGE FUNCTION ERROR CONTEXT:',
          error.context,
        );

        imageCache.current.set(
          cleanName.toLowerCase(),
          null,
        );

        update(key, {
          image_url: null,
          image_loading: false,
        });

        return;
      }

      const result =
        data?.items?.[0] as ImageLookupResult | undefined;

      const imageResult =
        result && typeof result === 'object'
          ? result
          : null;

      imageCache.current.set(
        cleanName.toLowerCase(),
        imageResult,
      );

      update(key, {
        image_url: imageResult?.image_url ?? null,
        image_loading: false,
      });
    } catch (error) {
      if (
        imageRequestIds.current.get(key) !==
        requestId
      ) {
        return;
      }

      console.warn(
        `Image lookup failed for "${cleanName}":`,
        error,
      );

      imageCache.current.set(
        cleanName.toLowerCase(),
        null,
      );

      update(key, {
        image_url: null,
        image_loading: false,
      });
    }
  }

  function handleItemNameChange(
    key: string,
    name: string,
  ) {
    const existingTimer =
      imageTimers.current.get(key);

    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    update(key, {
      name,
      image_url: null,
      image_loading: false,
    });

    const cleanName = name.trim();

    if (!cleanName) {
      imageRequestIds.current.set(
        key,
        (imageRequestIds.current.get(key) ?? 0) + 1,
      );
      return;
    }

    if (cleanName.length < 2) {
      return;
    }

    const timer = setTimeout(() => {
      imageTimers.current.delete(key);

      lookupImage(key, cleanName);
    }, IMAGE_LOOKUP_DELAY);

    imageTimers.current.set(key, timer);
  }

  function removeItem(key: string) {
    const existingTimer =
      imageTimers.current.get(key);

    if (existingTimer) {
      clearTimeout(existingTimer);
      imageTimers.current.delete(key);
    }

    imageRequestIds.current.set(
      key,
      (imageRequestIds.current.get(key) ?? 0) + 1,
    );

    setItems((rows) =>
      rows.filter((row) => row.key !== key),
    );
  }

  async function save() {
    const rows = items.filter(
      (row) =>
        row.name.trim() ||
        row.price.trim(),
    );

    const deliveryCharge =
      Number(delivery || 0);

    const bad = rows.find(
      (row) =>
        !row.name.trim() ||
        row.price.trim() === '' ||
        !(Number(row.price) >= 0) ||
        !Number.isInteger(Number(row.qty)) ||
        Number(row.qty) < 1,
    );

    if (!rows.length) {
      return Alert.alert('Add at least one item');
    }

    if (bad) {
      return Alert.alert(
        'Check your items',
        'Every item needs a name, a price, and a whole-number quantity.',
      );
    }

    if (!(deliveryCharge >= 0)) {
      return Alert.alert(
        'Delivery charge must be a number',
      );
    }

    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      isNaN(Date.parse(date))
    ) {
      return Alert.alert(
        'Date must be YYYY-MM-DD',
      );
    }

    const order = {
      title: title.trim(),
      ordered_on: date,
      delivery_charge: deliveryCharge,
    };

    const toRow = (row: Draft) => ({
      name: row.name.trim(),
      unit_price: Number(row.price),
      qty: Number(row.qty),
      image_url: row.image_url ?? null,
    });

    setBusy(true);

    try {
      if (!id) {
        const { data, error } =
          await supabase
            .from('orders')
            .insert({
              ...order,
              team_id: member.team_id,
              created_by: member.id,
            })
            .select('id')
            .single();

        if (error) throw error;

        const {
          error: itemsError,
        } = await supabase
          .from('order_items')
          .insert(
            rows.map((row) => ({
              ...toRow(row),
              order_id: data.id,
            })),
          );

        if (itemsError) {
          await supabase
            .from('orders')
            .delete()
            .eq('id', data.id);

          throw itemsError;
        }

        router.replace({
          pathname: '/order/[id]',
          params: { id: data.id },
        });

        return;
      }

      const {
        data: updated,
        error,
      } = await supabase
        .from('orders')
        .update(order)
        .eq('id', id)
        .select('id');

      if (error) throw error;

      if (!updated.length) {
        throw new Error(
          'This order is closed and can no longer be edited.',
        );
      }

      for (const row of rows.filter(
        (item) => item.id,
      )) {
        const { error } =
          await supabase
            .from('order_items')
            .update(toRow(row))
            .eq('id', row.id!);

        if (error) {
          throw new Error(
            `${row.name}: ${error.message}`,
          );
        }
      }

      const added = rows
        .filter((row) => !row.id)
        .map((row) => ({
          ...toRow(row),
          order_id: id,
        }));

      if (added.length) {
        const { error } =
          await supabase
            .from('order_items')
            .insert(added);

        if (error) throw error;
      }

      const removed = originalIds.filter(
        (originalId) =>
          !rows.some(
            (row) => row.id === originalId,
          ),
      );

      if (removed.length) {
        const { error } =
          await supabase
            .from('order_items')
            .delete()
            .in('id', removed);

        if (error) throw error;
      }

      router.back();
    } catch (e) {
      Alert.alert(
        'Could not save',
        (e as Error).message,
      );
    } finally {
      setBusy(false);
    }
  }

  const lineTotal = (row: Draft) =>
    (Number(row.price) || 0) *
    (Number(row.qty) || 0);

  const itemsTotal = items.reduce(
    (sum, row) =>
      sum + lineTotal(row),
    0,
  );

  const deliveryTotal =
    Number(delivery) || 0;

  return (
    <>
      <Stack.Screen
        options={{
          title: id
            ? 'Edit order'
            : 'New order',
        }}
      />

      <ScrollView
        contentContainerStyle={styles.screen}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
      >
        <ThemedText
          type="label"
          themeColor="textSecondary"
          style={styles.section}
        >
          Order details
        </ThemedText>

        <Card>
          <Input
            label="Where from?"
            placeholder="e.g. KFC (optional)"
            value={title}
            onChangeText={setTitle}
          />

          <Row
            style={{
              alignItems: 'flex-start',
            }}
          >
            <Input
              style={{ flex: 1 }}
              label="Date"
              placeholder="YYYY-MM-DD"
              value={date}
              onChangeText={setDate}
            />

            <Input
              style={{ flex: 1 }}
              label={`Delivery fee (${CURRENCY})`}
              placeholder="0"
              value={delivery}
              onChangeText={setDelivery}
              keyboardType="decimal-pad"
            />
          </Row>

          <ThemedText
            type="small"
            themeColor="textSecondary"
            style={{ fontSize: 13 }}
          >
            The delivery fee is split evenly
            between everyone who claims an item.
          </ThemedText>
        </Card>

        <ThemedText
          type="label"
          themeColor="textSecondary"
          style={styles.section}
        >
          What was ordered
        </ThemedText>

        {items.map((row, index) => (
          <Card key={row.key}>
            <Row>
              <ThemedText type="smallBold">
                Item {index + 1}
              </ThemedText>

              <IconButton
                icon="close"
                label={`Remove item ${
                  index + 1
                }`}
                onPress={() =>
                  removeItem(row.key)
                }
              />
            </Row>

            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
                marginTop: 4,
                marginBottom: 12,
              }}
            >
              {row.image_loading ? (
                <View
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: 10,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: 'rgba(127,127,127,0.08)',
                  }}
                >
                  <ActivityIndicator />
                </View>
              ) : row.image_url ? (
                <Image
                  source={{
                    uri: row.image_url,
                  }}
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: 10,
                  }}
                  resizeMode="cover"
                />
              ) : null}

              <View style={{ flex: 1 }}>
                <Input
                  placeholder="e.g. Zinger burger"
                  value={row.name}
                  onChangeText={(name) =>
                    handleItemNameChange(
                      row.key,
                      name,
                    )
                  }
                />
              </View>
            </View>

            <Row
              style={{
                alignItems: 'flex-start',
              }}
            >
              <Input
                style={{ flex: 1 }}
                label={`Price each (${CURRENCY})`}
                placeholder="0"
                value={row.price}
                onChangeText={(price) =>
                  update(row.key, {
                    price,
                  })
                }
                keyboardType="decimal-pad"
              />

              <View
                style={{
                  width: 150,
                }}
              >
                <Stepper
                  label="How many"
                  value={
                    Number(row.qty) || 1
                  }
                  onChange={(n) =>
                    update(row.key, {
                      qty: String(n),
                    })
                  }
                />
              </View>
            </Row>

            {lineTotal(row) > 0 && (
              <ThemedText
                type="small"
                themeColor="textSecondary"
                style={{
                  textAlign: 'right',
                }}
              >
                {money(lineTotal(row))}
              </ThemedText>
            )}
          </Card>
        ))}

        <Button
          title="Add another item"
          icon="add"
          variant="secondary"
          onPress={() =>
            setItems((rows) => [
              ...rows,
              blank(),
            ])
          }
        />

        <Card
          style={{
            marginTop: 8,
          }}
        >
          <Row>
            <ThemedText
              type="small"
              themeColor="textSecondary"
            >
              Items
            </ThemedText>

            <ThemedText type="small">
              {money(itemsTotal)}
            </ThemedText>
          </Row>

          <Row>
            <ThemedText
              type="small"
              themeColor="textSecondary"
            >
              Delivery
            </ThemedText>

            <ThemedText type="small">
              {money(deliveryTotal)}
            </ThemedText>
          </Row>

          <Divider />

          <Row>
            <ThemedText type="smallBold">
              Total bill
            </ThemedText>

            <ThemedText
              type="subtitle"
              style={{
                fontSize: 22,
                fontVariant: [
                  'tabular-nums',
                ],
              }}
            >
              {money(
                itemsTotal +
                  deliveryTotal,
              )}
            </ThemedText>
          </Row>
        </Card>

        <Button
          title={
            busy
              ? 'Saving…'
              : id
                ? 'Save changes'
                : 'Create order'
          }
          icon="check"
          disabled={busy}
          onPress={save}
        />
      </ScrollView>
    </>
  );
}