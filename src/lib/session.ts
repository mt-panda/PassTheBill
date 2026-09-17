import { createContext, useContext } from 'react';

export type Member = {
  id: string;
  name: string;
  team_id: string;
  teams: { name: string; code: string };
};

export const Session = createContext<{ member: Member | null; reload: () => Promise<void> }>({
  member: null,
  reload: async () => {},
});

export const useSession = () => useContext(Session);

export const CURRENCY = 'Rs';

export const money = (n: number) => `${CURRENCY} ${Math.round(n).toLocaleString()}`;

const pad = (n: number) => String(n).padStart(2, '0');

/** Local-time YYYY-MM-DD (toISOString would give UTC and can be off by a day). */
export const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
