import { useState } from 'react';

import { friendlyError, reportError, type FriendlyError } from '@/lib/errors';
import { useSession } from '@/lib/session';
import { supabase, useLive } from '@/lib/supabase';

import type { OrderRow, Review } from './classify';

const SELECT =
  'id, title, ordered_on, created_at, status, delivery_charge, created_by, creator:members!orders_created_by_fkey(name), extra_charges(id, amount, label, status, member_id), delivery_exclusions(member_id), order_items(qty, unit_price, claims(units, member_id))';

/**
 * Current orders = open orders (never in a review) + closed orders in the open review
 * + closed orders in no review. Orders only in closed reviews are hidden.
 */
export function useOrders() {
  const me = useSession().member!.id;
  const [orders, setOrders] = useState<OrderRow[] | null>(null);
  const [inReview, setInReview] = useState<Set<string>>(new Set());
  const [myAmounts, setMyAmounts] = useState<Record<string, number>>({});
  const [review, setReview] = useState<Review>(null);
  const [error, setError] = useState<FriendlyError | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  async function load(isLatest: () => boolean = () => true) {
    try {
      const { data: cycle, error: e1 } = await supabase
        .from('billing_cycles')
        .select('id')
        .eq('status', 'open')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (e1) throw e1;

      const [cycleOrders, untallied, mine] = await Promise.all([
        cycle ? supabase.from('billing_cycle_orders').select('order_id').eq('cycle_id', cycle.id) : null,
        supabase.from('untallied_closed_orders').select('id'),
        cycle
          ? supabase.from('billing_cycle_member_totals').select('grand_total, confirmed_at').eq('cycle_id', cycle.id).eq('member_id', me).maybeSingle()
          : null,
      ]);
      const e2 = cycleOrders?.error ?? untallied.error ?? mine?.error;
      if (e2) throw e2;

      const reviewIds = (cycleOrders?.data ?? []).map((r) => r.order_id as string);
      const closedIds = [...reviewIds, ...(untallied.data ?? []).map((r) => r.id as string)];
      const query = supabase.from('orders').select(SELECT);
      const { data, error: e3 } = await (closedIds.length ? query.or(`status.eq.open,id.in.(${closedIds.join(',')})`) : query.eq('status', 'open'))
        .order('ordered_on', { ascending: false })
        .order('created_at', { ascending: false });
      if (e3) throw e3;
      const rows = (data ?? []) as unknown as OrderRow[];

      const { data: totals, error: e4 } = rows.length
        ? await supabase
            .from('order_member_totals')
            .select('order_id, items_total, delivery_share, extras_total')
            .eq('member_id', me)
            .in('order_id', rows.map((o) => o.id))
        : { data: [], error: null };
      if (e4) throw e4;

      if (!isLatest()) return;
      setOrders(rows);
      setInReview(new Set(reviewIds));
      setMyAmounts(
        Object.fromEntries((totals ?? []).map((t) => [t.order_id, Number(t.items_total) + Number(t.delivery_share) + Number(t.extras_total)]))
      );
      setReview(mine?.data ? { myTotal: Number(mine.data.grand_total), confirmed: !!mine.data.confirmed_at } : null);
      setError(null);
    } catch (e) {
      reportError('orders.load', e);
      // Background refresh failures keep the stale list; only a first load shows the error state.
      if (isLatest() && orders === null) setError(friendlyError(e));
    }
  }

  useLive('billing_cycles,billing_cycle_confirmations,orders,order_items,claims,extra_charges,delivery_exclusions', load);

  return {
    me,
    orders,
    inReview,
    myAmounts,
    review,
    error,
    refreshing,
    refresh: async () => {
      setRefreshing(true);
      await load();
      setRefreshing(false);
    },
  };
}
