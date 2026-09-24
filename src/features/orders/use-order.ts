import { useState } from 'react';

import { friendlyError, reportError, type FriendlyError } from '@/lib/errors';
import { useSession } from '@/lib/session';
import { supabase, useLive } from '@/lib/supabase';

export type Claim = { id: string; member_id: string; units: number; members: { name: string } | null };
export type Item = { id: string; name: string; unit_price: number; qty: number; image_url: string | null; claims: Claim[] };
export type ChargeStatus = 'pending' | 'accepted' | 'rejected';
export type Charge = {
  id: string;
  member_id: string;
  label: string;
  amount: number;
  status: ChargeStatus;
  members: { name: string } | null;
};
export type Order = {
  id: string;
  title: string;
  ordered_on: string;
  delivery_charge: number;
  status: 'open' | 'closed';
  created_by: string;
  creator: { name: string } | null; // null when the creator left the team (RLS hides them)
  delivery_exclusions: { member_id: string }[];
  extra_charges: Charge[];
  order_items: Item[];
};
export type Share = { member_id: string; items_total: number; delivery_share: number; extras_total: number };
export type Teammate = { id: string; name: string };

type Result = { error: { message: string } | null };

export function useOrder(id: string) {
  const me = useSession().member!.id;
  const [order, setOrder] = useState<Order | null>();
  const [shares, setShares] = useState<Share[]>([]);
  const [loadError, setLoadError] = useState<FriendlyError | null>(null);
  // item id -> optimistic units; a row stays pending until the reload after its write has landed.
  const [pending, setPending] = useState<Record<string, number>>({});

  async function load(isLatest: () => boolean = () => true) {
    const [o, s] = await Promise.all([
      supabase
        .from('orders')
        .select(
          '*, creator:members!orders_created_by_fkey(name), delivery_exclusions(member_id), extra_charges(id, member_id, label, amount, status, members(name)), order_items(id, name, unit_price, qty, image_url, claims(id, member_id, units, members(name)))'
        )
        .eq('id', id)
        .maybeSingle(),
      supabase.from('order_member_totals').select('member_id, items_total, delivery_share, extras_total').eq('order_id', id),
    ]);
    if (!isLatest()) return;
    const error = o.error ?? s.error;
    if (error) {
      reportError('order.load', error);
      // Keep showing stale data on a failed background refresh; only a first load shows the error state.
      if (order === undefined) setLoadError(friendlyError(error));
      return;
    }
    setLoadError(null);
    setOrder(o.data as unknown as Order | null);
    setShares((s.data ?? []) as Share[]);
  }

  useLive('orders,order_items,claims,extra_charges,delivery_exclusions', load, id);

  /** Runs a write, then reloads. Returns a friendly error or null. */
  async function mutate(action: () => PromiseLike<Result>): Promise<FriendlyError | null> {
    const { error } = await action();
    await load();
    if (!error) return null;
    reportError('order.mutate', error);
    return friendlyError(error);
  }

  async function pick(item: Item, delta: 1 | -1): Promise<FriendlyError | null> {
    const mine = item.claims.find((c) => c.member_id === me);
    const units = (mine?.units ?? 0) + delta;
    setPending((p) => ({ ...p, [item.id]: units }));
    const err = await mutate(() =>
      !mine
        ? supabase.from('claims').insert({ item_id: item.id, member_id: me, units })
        : units === 0
          ? supabase.from('claims').delete().eq('id', mine.id)
          : supabase.from('claims').update({ units }).eq('id', mine.id)
    );
    setPending(({ [item.id]: _, ...rest }) => rest);
    return err;
  }

  async function teammates(): Promise<Teammate[]> {
    const { data, error } = await supabase.from('members').select('id, name').order('name');
    if (error) reportError('order.teammates', error);
    return (data ?? []) as Teammate[];
  }

  return {
    me,
    order,
    shares,
    loadError,
    pending,
    reload: () => load(),
    pick,
    teammates,
    toggleDelivery: (memberId: string, excluded: boolean) =>
      mutate(() =>
        excluded
          ? supabase.from('delivery_exclusions').delete().eq('order_id', id).eq('member_id', memberId)
          : supabase.from('delivery_exclusions').insert({ order_id: id, member_id: memberId })
      ),
    addCharge: (memberId: string, label: string, amount: number) =>
      mutate(() => supabase.from('extra_charges').insert({ order_id: id, member_id: memberId, label, amount })),
    removeCharge: (chargeId: string) => mutate(() => supabase.from('extra_charges').delete().eq('id', chargeId)),
    respond: (chargeId: string, accept: boolean) =>
      mutate(() => supabase.rpc('respond_to_charge', { p_charge_id: chargeId, p_accept: accept })),
    close: () => mutate(() => supabase.rpc('close_order', { p_order_id: id })),
    adopt: () => mutate(() => supabase.rpc('adopt_order', { p_order_id: id })),
    remove: async () => {
      const { error } = await supabase.from('orders').delete().eq('id', id);
      if (!error) return null;
      reportError('order.delete', error);
      return friendlyError(error);
    },
  };
}
