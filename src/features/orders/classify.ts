import type { Status } from '@/components/ui/status-badge';

import { shortDate, ymd } from '@/lib/format';

export type OrderRow = {
  id: string;
  title: string;
  ordered_on: string;
  created_at: string;
  status: 'open' | 'closed';
  delivery_charge: number;
  created_by: string;
  creator: { name: string } | null;
  extra_charges: { id: string; amount: number; label: string; status: 'pending' | 'accepted' | 'rejected'; member_id: string }[];
  delivery_exclusions: { member_id: string }[];
  order_items: { qty: number; unit_price: number; claims: { units: number; member_id: string }[] }[];
};

export function facts(o: OrderRow, me: string) {
  const claims = o.order_items.flatMap((i) => i.claims);
  const qty = o.order_items.reduce((s, i) => s + i.qty, 0);
  const picked = claims.reduce((s, c) => s + c.units, 0);
  const myUnits = claims.filter((c) => c.member_id === me).reduce((s, c) => s + c.units, 0);
  const food = o.order_items.reduce((s, i) => s + i.qty * i.unit_price, 0);
  const accepted = o.extra_charges.filter((c) => c.status === 'accepted').reduce((s, c) => s + c.amount, 0);
  const excluded = new Set(o.delivery_exclusions.map((x) => x.member_id));
  const eaters = new Set(claims.map((c) => c.member_id));
  return {
    qty,
    left: qty - picked,
    myUnits,
    total: food + o.delivery_charge + accepted,
    isCreator: o.created_by === me,
    myPendingCharge: o.extra_charges.find((c) => c.member_id === me && c.status === 'pending') ?? null,
    pendingCharges: o.extra_charges.filter((c) => c.status === 'pending').length,
    declinedCharges: o.extra_charges.filter((c) => c.status === 'rejected').length,
    nobodySharesDelivery: o.delivery_charge > 0 && eaters.size > 0 && [...eaters].every((m) => excluded.has(m)),
  };
}

/** Badge precedence (spec §8.1): first matching rule wins. */
export function badge(o: OrderRow, me: string): { status: Status; label: string } {
  const f = facts(o, me);
  if (o.status === 'closed') return { status: 'closed', label: 'Closed' };
  if (f.myPendingCharge) return { status: 'attention', label: 'Charge needs your answer' };
  if (f.left > 0) return f.isCreator ? { status: 'waiting', label: `${f.left} left to pick` } : { status: 'open', label: `${f.left} left` };
  if (f.isCreator && f.pendingCharges) return { status: 'waiting', label: 'Extra charge pending' };
  if (f.isCreator && f.declinedCharges) return { status: 'waiting', label: 'Declined charge to fix' };
  if (f.isCreator && f.nobodySharesDelivery) return { status: 'waiting', label: 'Nobody shares delivery' };
  return f.isCreator ? { status: 'ready', label: 'Ready to close' } : { status: 'open', label: 'All picked' };
}

export type Review = { myTotal: number; confirmed: boolean } | null;

export type Hero =
  | { kind: 'attention'; order: OrderRow; amount: number }
  | { kind: 'review'; total: number }
  | { kind: 'lunch'; order: OrderRow; label: string }
  | null;

export function lunchLabel(orderedOn: string, today = new Date()): string {
  const t = ymd(today);
  if (orderedOn === t) return 'Lunch today';
  return orderedOn > t ? `Next lunch · ${shortDate(orderedOn, today)}` : `Still open · ${shortDate(orderedOn, today)}`;
}

/** One card at the top: what needs me most (spec §8.1 priority). */
export function pickHero(orders: OrderRow[], me: string, review: Review, today = new Date()): Hero {
  const open = orders.filter((o) => o.status === 'open');
  const charged = open
    .map((o) => ({ o, c: facts(o, me).myPendingCharge }))
    .filter((x) => x.c)
    .sort((a, b) => a.o.created_at.localeCompare(b.o.created_at))[0];
  if (charged) return { kind: 'attention', order: charged.o, amount: charged.c!.amount };
  if (review && review.myTotal > 0 && !review.confirmed) return { kind: 'review', total: review.myTotal };
  const t = ymd(today);
  const rank = (o: OrderRow) => (o.ordered_on === t ? 0 : o.ordered_on > t ? 1 : 2);
  const lunch = [...open].sort(
    (a, b) =>
      rank(a) - rank(b) ||
      (rank(a) === 1 ? a.ordered_on.localeCompare(b.ordered_on) : b.ordered_on.localeCompare(a.ordered_on)) ||
      b.created_at.localeCompare(a.created_at)
  )[0];
  return lunch ? { kind: 'lunch', order: lunch, label: lunchLabel(lunch.ordered_on, today) } : null;
}
