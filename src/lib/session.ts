import { createContext, useContext } from 'react';

export type Member = {
  id: string;
  name: string;
  team_id: string;
  teams: { name: string; code: string };
};

export type ThemePref = 'system' | 'light' | 'dark';

export const Session = createContext<{
  member: Member | null;
  reload: () => Promise<void>;
  finishOnboarding: () => void;
  themePref: ThemePref;
  setThemePref: (pref: ThemePref) => void;
}>({
  member: null,
  reload: async () => {},
  finishOnboarding: () => {},
  themePref: 'system',
  setThemePref: () => {},
});

export const useSession = () => useContext(Session);

export const CURRENCY = 'Rs';

export const money = (n: number) => `${CURRENCY} ${Math.round(n).toLocaleString()}`;

const pad = (n: number) => String(n).padStart(2, '0');

/** Local-time YYYY-MM-DD (toISOString would give UTC and can be off by a day). */
export const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** "2026-09-17" → "Thu, 17 Sep". Parsed as local time for the same reason as ymd. */
export const niceDate = (s: string) => {
  const [y, m, d] = s.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
};
