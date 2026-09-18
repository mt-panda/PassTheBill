export type BillingCycleSummaryInput = {
  id: string;
  triggered_by: string;
  status: 'open' | 'closed';
  created_at: string;
  closed_at: string | null;
};

export type BillingCycleTotalInput = {
  cycle_id: string;
  member_id: string;
  member_name: string;
  items_total: number;
  delivery_total: number;
  extras_total: number;
  grand_total: number;
  confirmed_at: string | null;
};

export type BillingCycleSummary = BillingCycleSummaryInput & {
  order_count: number;
  member_count: number;
  confirmed_count: number;
  total: number;
};

export function summarizeCycle(
  cycle: BillingCycleSummaryInput,
  totals: BillingCycleTotalInput[],
  orderCount: number,
): BillingCycleSummary {
  const cycleTotals = totals.filter((t) => t.cycle_id === cycle.id);
  return {
    ...cycle,
    order_count: orderCount,
    member_count: cycleTotals.length,
    confirmed_count: cycleTotals.filter((t) => !!t.confirmed_at).length,
    total: cycleTotals.reduce((sum, t) => sum + Number(t.grand_total), 0),
  };
}
