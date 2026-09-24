import { useState } from 'react';

import { friendlyError, reportError, type FriendlyError } from '@/lib/errors';
import { useSession } from '@/lib/session';
import { supabase, useLive } from '@/lib/supabase';

export type Cycle = { id: string; triggered_by: string | null; created_at: string; closed_at: string | null };
export type TeamRow = {
  member_id: string;
  member_name: string;
  items_total: number;
  delivery_total: number;
  extras_total: number;
  grand_total: number;
  confirmed_at: string | null;
  is_member: boolean;
};
export type Lunch = { order_id: string; title: string; ordered_on: string; creator: string | null; created_by: string; amount: number };

const PAGE = Number(process.env.EXPO_PUBLIC_HISTORY_PAGE_SIZE) || 20;

// is_member arrives with redesign-release.sql; until then (no column) everyone listed counts as a member.
const toTeamRow = (t: TeamRow): TeamRow => ({ ...t, grand_total: Number(t.grand_total), is_member: t.is_member !== false });

export function useBilling() {
  const me = useSession().member!.id;
  const [state, setState] = useState<{
    cycle: Cycle | null;
    team: TeamRow[];
    myLunches: Lunch[]; // every order I have a share in, with its amount
    cycleOf: Record<string, string>; // order_id -> cycle_id (all reviews)
    history: Cycle[];
    myHistory: Record<string, number>; // cycle_id -> my grand_total
    untallied: number;
    openOrders: number;
  } | null>(null);
  const [pages, setPages] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<FriendlyError | null>(null);

  async function load(isLatest: () => boolean = () => true) {
    try {
      const [open, untallied, openOrders, links, mine, closed] = await Promise.all([
        supabase.from('billing_cycles').select('id, triggered_by, created_at, closed_at').eq('status', 'open').limit(1).maybeSingle(),
        supabase.from('untallied_closed_orders').select('id', { count: 'exact', head: true }),
        supabase.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'open'),
        supabase.from('billing_cycle_orders').select('order_id, cycle_id'),
        supabase.from('order_member_totals').select('order_id, items_total, delivery_share, extras_total').eq('member_id', me),
        supabase
          .from('billing_cycles')
          .select('id, triggered_by, created_at, closed_at')
          .eq('status', 'closed')
          .order('closed_at', { ascending: false })
          .limit(PAGE * pages + 1),
      ]);
      const e1 = open.error ?? untallied.error ?? openOrders.error ?? links.error ?? mine.error ?? closed.error;
      if (e1) throw e1;

      const cycle = (open.data as Cycle | null) ?? null;
      const history = ((closed.data ?? []) as Cycle[]).slice(0, PAGE * pages);
      const ids = [...new Set([...(mine.data ?? []).map((r) => r.order_id as string), ...(links.data ?? []).map((r) => r.order_id as string)])];

      const [team, orders, myHistory] = await Promise.all([
        cycle ? supabase.from('billing_cycle_member_totals').select('*').eq('cycle_id', cycle.id) : null,
        ids.length
          ? supabase.from('orders').select('id, title, ordered_on, created_by, creator:members!orders_created_by_fkey(name)').in('id', ids)
          : null,
        history.length
          ? supabase.from('billing_cycle_member_totals').select('cycle_id, grand_total').eq('member_id', me).in('cycle_id', history.map((c) => c.id))
          : null,
      ]);
      const e2 = team?.error ?? orders?.error ?? myHistory?.error;
      if (e2) throw e2;

      const info = new Map(
        ((orders?.data ?? []) as unknown as { id: string; title: string; ordered_on: string; created_by: string; creator: { name: string } | null }[]).map((o) => [o.id, o])
      );
      const amounts = new Map((mine.data ?? []).map((r) => [r.order_id as string, Number(r.items_total) + Number(r.delivery_share) + Number(r.extras_total)]));
      const myLunches: Lunch[] = [...info.values()].map((o) => ({
        order_id: o.id,
        title: o.title,
        ordered_on: o.ordered_on,
        created_by: o.created_by,
        creator: o.creator?.name ?? null,
        amount: amounts.get(o.id) ?? 0,
      }));

      if (!isLatest()) return;
      setState({
        cycle,
        team: ((team?.data ?? []) as TeamRow[]).map(toTeamRow),
        myLunches,
        cycleOf: Object.fromEntries((links.data ?? []).map((r) => [r.order_id, r.cycle_id])),
        history,
        myHistory: Object.fromEntries((myHistory?.data ?? []).map((r) => [r.cycle_id, Number(r.grand_total)])),
        untallied: untallied.count ?? 0,
        openOrders: openOrders.count ?? 0,
      });
      setHasMore((closed.data ?? []).length > PAGE * pages);
      setError(null);
    } catch (e) {
      reportError('billing.load', e);
      if (isLatest() && state === null) setError(friendlyError(e));
    }
  }

  useLive('orders,order_items,claims,extra_charges,delivery_exclusions,billing_cycles,billing_cycle_confirmations', load, String(pages));

  async function run(action: () => PromiseLike<{ error: { message: string } | null }>): Promise<FriendlyError | null> {
    const { error: e } = await action();
    await load();
    if (!e) return null;
    reportError('billing.action', e);
    return friendlyError(e);
  }

  return {
    me,
    state,
    error,
    hasMore,
    reload: () => load(),
    showOlder: () => setPages((p) => p + 1),
    start: () => run(() => supabase.rpc('trigger_billing_cycle')),
    confirm: (cycleId: string) => run(() => supabase.rpc('confirm_billing_cycle', { p_cycle_id: cycleId })),
    finish: (cycleId: string) => run(() => supabase.rpc('close_billing_cycle', { p_cycle_id: cycleId })),
    teamFor: async (cycleId: string): Promise<TeamRow[]> => {
      const { data, error: e } = await supabase.from('billing_cycle_member_totals').select('*').eq('cycle_id', cycleId);
      if (e) reportError('billing.team', e);
      return ((data ?? []) as TeamRow[]).map(toTeamRow);
    },
  };
}
