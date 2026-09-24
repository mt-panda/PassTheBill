/** Trim, collapse whitespace, lowercase. "PizzaHut" and "Pizza Hut" stay different on purpose. */
export const normalizeTitle = (t: string) => t.trim().replace(/\s+/g, ' ').toLowerCase();

export type Suggestion = { title: string; lastOrderedOn: string; count: number };

/** Distinct past titles, newest first. `rows` must already be sorted newest first. */
export function buildSuggestions(rows: { title: string; ordered_on: string }[], limit = 20): Suggestion[] {
  const byKey = new Map<string, Suggestion>();
  for (const r of rows) {
    const key = normalizeTitle(r.title);
    if (!key) continue;
    const s = byKey.get(key);
    if (s) s.count++;
    else byKey.set(key, { title: r.title.trim().replace(/\s+/g, ' '), lastOrderedOn: r.ordered_on, count: 1 });
  }
  return [...byKey.values()].slice(0, limit);
}

/** Filters by the typed text; offers "Use '<text>'" when nothing matches exactly. */
export function filterSuggestions(all: Suggestion[], text: string): { useTyped: string | null; list: Suggestion[] } {
  const q = normalizeTitle(text);
  if (!q) return { useTyped: null, list: all };
  const list = all.filter((s) => normalizeTitle(s.title).includes(q));
  const exact = all.some((s) => normalizeTitle(s.title) === q);
  return { useTyped: exact ? null : text.trim().replace(/\s+/g, ' '), list };
}
