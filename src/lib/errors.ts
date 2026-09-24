export type FriendlyError = { title: string; message: string; retryable: boolean };

type Rule = {
  match: RegExp;
  message: string | ((m: RegExpMatchArray) => string);
  title?: string;
  retryable?: boolean;
};

const GENERIC_TITLE = 'Something went wrong';
const GENERIC: FriendlyError = {
  title: GENERIC_TITLE,
  message: 'Something went wrong. Please try again.',
  retryable: true,
};

// Server strings are matched with regexes. Postgres substitutes '%' placeholders, so never match a literal '%'.
const RULES: Rule[] = [
  {
    match: /network request failed|failed to fetch|fetch failed/i,
    title: "You're offline",
    message: "You're offline. Check your connection and try again.",
    retryable: true,
  },
  { match: /only \d+ unit\(s\) left/i, message: 'Someone just took the last one.', retryable: true },
  { match: /(\d+) unit\(s\) already claimed/i, message: (m) => `${m[1]} already picked. You can't go below that.` },
  { match: /duplicate key value.*claims_item_id_member_id_key/i, message: 'That just changed. Try again.', retryable: true },
  { match: /every unit must be claimed/i, message: 'Every item needs to be picked before closing.' },
  { match: /every extra charge must be accepted/i, message: 'An extra charge is still waiting for an answer.' },
  { match: /at least one person must share the delivery fee/i, message: 'At least one person needs to share delivery.' },
  { match: /only the person who created this order/i, message: 'Only the person who created this lunch can do that.' },
  { match: /order not found or already closed/i, message: 'This lunch is already closed.' },
  { match: /charge not found or already answered/i, message: 'That charge was already answered.' },
  { match: /no team with code/i, message: "We couldn't find that team code." },
  { match: /only the person who started this tally/i, message: 'Only the person who started this review can finish it.' },
  { match: /all participating members must confirm/i, message: 'Everyone needs to confirm before this review can finish.' },
  { match: /cycle not found or already closed/i, message: 'This review has already finished.' },
  { match: /save_order: title too long/i, message: 'That name is too long (80 characters max).' },
  { match: /save_order: no items/i, message: 'Add at least one item.' },
  { match: /save_order: order not editable/i, message: "This lunch is closed and can't be edited." },
  { match: /save_order: item not found/i, message: 'This lunch changed while you were editing. Reopen it and try again.' },
  { match: /team switch blocked: open order/i, message: 'Close or delete the lunch you created first.' },
  { match: /team switch blocked: unconfirmed review/i, message: 'Confirm your review total first.' },
  { match: /adopt_order: not allowed/i, message: 'Only a teammate can take over a lunch whose creator left.' },
];

function messageOf(e: unknown): string {
  if (typeof e === 'string') return e;
  if (e && typeof e === 'object' && 'message' in e) return String((e as { message: unknown }).message ?? '');
  return '';
}

/** Maps any thrown value / Supabase error to user copy. Never returns raw server text. */
export function friendlyError(e: unknown): FriendlyError {
  const text = messageOf(e);
  for (const rule of RULES) {
    const m = text.match(rule.match);
    if (m) {
      return {
        title: rule.title ?? GENERIC_TITLE,
        message: typeof rule.message === 'function' ? rule.message(m) : rule.message,
        retryable: rule.retryable ?? false,
      };
    }
  }
  return GENERIC;
}

/** Technical details stay in logs (there is no remote logging in this app). */
export function reportError(context: string, e: unknown): void {
  console.warn(`[${context}]`, e);
}
