import { createContext, useContext } from 'react';

import type { FriendlyError } from '@/lib/errors';

export type Member = {
  id: string;
  name: string;
  team_id: string;
  teams: { name: string; code: string };
};

export type ThemePref = 'system' | 'light' | 'dark';

export const Session = createContext<{
  member: Member | null;
  reload: () => Promise<{ error?: FriendlyError }>;
  finishOnboarding: () => void;
  themePref: ThemePref;
  setThemePref: (pref: ThemePref) => void;
}>({
  member: null,
  reload: async () => ({}),
  finishOnboarding: () => {},
  themePref: 'light',
  setThemePref: () => {},
});

export const useSession = () => useContext(Session);

/** Light is the default; a stored 'system' is honoured explicitly. */
export const restoreThemePref = (stored: string | null): ThemePref =>
  stored === 'dark' || stored === 'system' ? stored : 'light';

export { CURRENCY, money, shortDate as niceDate, ymd } from '@/lib/format';
