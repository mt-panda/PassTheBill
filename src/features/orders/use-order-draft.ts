import { useEffect, useRef, useState } from 'react';

import { friendlyError, reportError, type FriendlyError } from '@/lib/errors';
import { parseAmount, ymd } from '@/lib/format';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';

import { lookupFoodImage } from './food-image';

export type DraftItem = {
  key: string;
  id?: string;
  name: string;
  price: string;
  qty: number;
  url: string | null;
  loading: boolean;
  /** false = picture untouched since load (keep what's stored). */
  touched: boolean;
};

const LOOKUP_DELAY = 5000; // name inactivity before a picture lookup
const LOOKUP_WAIT = 8000; // max wait for pending pictures when saving

let seq = 0;
const newKey = () => `new-${Date.now()}-${seq++}`;

export function useOrderDraft(orderId?: string) {
  const me = useSession().member?.id;
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(ymd(new Date()));
  const [delivery, setDelivery] = useState('');
  const [items, setItems] = useState<DraftItem[]>([]);
  const [loaded, setLoaded] = useState(!orderId);
  const [loadError, setLoadError] = useState<FriendlyError | null>(null);
  const [baseline, setBaseline] = useState('');

  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const requestIds = useRef(new Map<string, number>());
  const inflight = useRef(new Map<string, Promise<string | null>>());
  const itemsRef = useRef(items);
  useEffect(() => {
    itemsRef.current = items;
  });

  useEffect(() => {
    const pending = timers.current;
    // Clear debounce timers on unmount; in-flight lookups keep running so post-save pictures still land.
    return () => pending.forEach(clearTimeout);
  }, []);

  useEffect(() => {
    if (!orderId) return;
    supabase
      .from('orders')
      .select('title, ordered_on, delivery_charge, order_items(id, name, unit_price, qty, image_url)')
      .eq('id', orderId)
      .single()
      .then(({ data, error }) => {
        if (error) {
          reportError('order-form.load', error);
          return setLoadError(friendlyError(error));
        }
        const rows = (data.order_items as { id: string; name: string; unit_price: number; qty: number; image_url: string | null }[]).map(
          (i): DraftItem => ({
            key: i.id,
            id: i.id,
            name: i.name,
            price: String(i.unit_price),
            qty: i.qty,
            url: i.image_url,
            loading: false,
            touched: false,
          })
        );
        setTitle(data.title);
        setDate(data.ordered_on);
        setDelivery(data.delivery_charge ? String(data.delivery_charge) : '');
        setItems(rows);
        setBaseline(snapshot(data.title, data.ordered_on, data.delivery_charge ? String(data.delivery_charge) : '', rows));
        setLoaded(true);
      });
  }, [orderId]);

  const update = (key: string, patch: Partial<DraftItem>) =>
    setItems((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const invalidate = (key: string) => requestIds.current.set(key, (requestIds.current.get(key) ?? 0) + 1);

  function startLookup(key: string, name: string) {
    const t = timers.current.get(key);
    if (t) clearTimeout(t);
    timers.current.delete(key);
    if (name.trim().length < 2) return;
    invalidate(key);
    const req = requestIds.current.get(key);
    update(key, { loading: true });
    const p = lookupFoodImage(name).then((url) => {
      if (requestIds.current.get(key) === req) update(key, { url, loading: false, touched: true });
      return url;
    });
    inflight.current.set(key, p);
  }

  function addItem(): string {
    const key = newKey();
    setItems((rows) => [...rows, { key, name: '', price: '', qty: 1, url: null, loading: false, touched: true }]);
    return key;
  }

  function setItemName(key: string, name: string) {
    const t = timers.current.get(key);
    if (t) clearTimeout(t);
    invalidate(key);
    update(key, { name, url: null, loading: false, touched: true });
    if (name.trim().length >= 2) timers.current.set(key, setTimeout(() => startLookup(key, name), LOOKUP_DELAY));
  }

  /** Called on "Save item": start the lookup now unless one is already running or done. */
  function lookupNow(key: string) {
    const row = itemsRef.current.find((r) => r.key === key);
    if (!row || row.loading || (row.url && !timers.current.has(key))) return;
    if (!row.touched && row.url) return;
    startLookup(key, row.name);
  }

  function removeItem(key: string) {
    const t = timers.current.get(key);
    if (t) clearTimeout(t);
    timers.current.delete(key);
    invalidate(key);
    setItems((rows) => rows.filter((r) => r.key !== key));
  }

  function replaceItem(row: DraftItem) {
    setItems((rows) => rows.map((r) => (r.key === row.key ? row : r)));
  }

  function validate(): string | null {
    if (title.trim().length > 80) return 'That name is too long (80 characters max).';
    if (!items.length) return 'Add at least one item.';
    const bad = items.find((r) => !r.name.trim() || parseAmount(r.price) === null || !Number.isInteger(r.qty) || r.qty < 1);
    if (bad) return 'Every item needs a name, a price, and a quantity of at least 1.';
    if (delivery.trim() && parseAmount(delivery) === null) return 'Delivery fee must be a number.';
    return null;
  }

  /** Edit only: items that would drop below what teammates already picked, and removed items someone picked. */
  async function checkEdit(): Promise<{ belowPicked: string | null; removedPicked: string[]; error?: FriendlyError }> {
    if (!orderId) return { belowPicked: null, removedPicked: [] };
    const { data, error } = await supabase
      .from('claims')
      .select('item_id, units, member_id, members(name), order_items!inner(order_id, name)')
      .eq('order_items.order_id', orderId);
    if (error) {
      reportError('order-form.checkEdit', error);
      return { belowPicked: null, removedPicked: [], error: friendlyError(error) };
    }
    const claims = (data ?? []) as unknown as {
      item_id: string;
      units: number;
      member_id: string;
      members: { name: string } | null;
      order_items: { name: string };
    }[];
    const pickedBy = new Map<string, { units: number; people: string[]; name: string }>();
    for (const c of claims) {
      const p = pickedBy.get(c.item_id) ?? { units: 0, people: [], name: c.order_items.name };
      p.units += c.units;
      p.people.push(c.member_id === me ? 'You' : (c.members?.name ?? 'Former member'));
      pickedBy.set(c.item_id, p);
    }
    const below = items.find((r) => r.id && r.qty < (pickedBy.get(r.id)?.units ?? 0));
    const kept = new Set(items.map((r) => r.id));
    const removedPicked = [...pickedBy.entries()]
      .filter(([id]) => !kept.has(id))
      .map(([, p]) => `${p.people.join(' and ')} picked ${p.name}`);
    return {
      belowPicked: below ? `${below.name}: ${pickedBy.get(below.id!)!.units} already picked. You can't go below that.` : null,
      removedPicked,
    };
  }

  async function save(): Promise<{ orderId?: string; error?: FriendlyError }> {
    // Wait (bounded) for pictures still being looked up, so fast typists still get thumbnails.
    const waiting = itemsRef.current.filter((r) => r.loading).map((r) => inflight.current.get(r.key));
    if (waiting.length) await Promise.race([Promise.all(waiting), new Promise((r) => setTimeout(r, LOOKUP_WAIT))]);

    const rows = itemsRef.current;
    const payload = rows.map((r) => ({
      ...(r.id ? { id: r.id } : {}),
      name: r.name.trim(),
      unit_price: parseAmount(r.price),
      qty: r.qty,
      // Still loading -> omit (keep/none); untouched existing picture -> omit (keep); else set or clear.
      ...(r.loading || (!r.touched && r.id) ? {} : { image_url: r.url }),
    }));

    const { data, error } = await supabase.rpc('save_order', {
      p_order_id: orderId ?? null,
      p_title: title.trim(),
      p_ordered_on: date,
      p_delivery: parseAmount(delivery) ?? 0,
      p_items: payload,
    });
    if (error) {
      reportError('order-form.save', error);
      return { error: friendlyError(error) };
    }
    const result = data as { order_id: string; item_ids: string[] };

    // Pictures that arrive after saving are written straight to their item.
    rows.forEach((r, i) => {
      if (!r.loading) return;
      inflight.current.get(r.key)?.then(async (url) => {
        if (!url) return;
        const { error: lateError } = await supabase.from('order_items').update({ image_url: url }).eq('id', result.item_ids[i]);
        if (lateError) reportError('order-form.lateImage', lateError);
      });
    });
    return { orderId: result.order_id };
  }

  const dirty = loaded && snapshot(title, date, delivery, items) !== (orderId ? baseline : snapshot('', ymd(new Date()), '', []));

  return {
    title,
    setTitle,
    date,
    setDate,
    delivery,
    setDelivery,
    items,
    loaded,
    loadError,
    dirty,
    addItem,
    update,
    replaceItem,
    setItemName,
    lookupNow,
    removeItem,
    validate,
    checkEdit,
    save,
  };
}

function snapshot(title: string, date: string, delivery: string, items: DraftItem[]) {
  return JSON.stringify([title.trim(), date, delivery.trim(), items.map((i) => [i.id, i.name.trim(), i.price, i.qty])]);
}
