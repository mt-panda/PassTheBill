import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

type Entry = { id: number; node: ReactNode };
type Actions = { set: (id: number, node: ReactNode) => void; remove: (id: number) => void };

// Two contexts on purpose: BottomSheet consumes only the *stable* actions. If it also consumed state that
// changes on every set(), each set() would re-render the sheet, which would set() again (infinite loop).
const ActionsContext = createContext<Actions | null>(null);
const OpenContext = createContext(false);

/**
 * Renders at most one sheet above the whole app in the main window, so a local KeyboardAvoidingView
 * works under edge-to-edge (an RN Modal's dialog window doesn't get keyboard events).
 * The app underneath is hidden from TalkBack while a sheet is open.
 */
export function SheetHost({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const set = useCallback((id: number, node: ReactNode) => {
    setEntries((prev) => {
      const i = prev.findIndex((e) => e.id === id);
      if (i === -1) return [...prev, { id, node }];
      const next = prev.slice();
      next[i] = { id, node };
      return next;
    });
  }, []);
  const remove = useCallback(
    (id: number) => setEntries((prev) => (prev.some((e) => e.id === id) ? prev.filter((e) => e.id !== id) : prev)),
    []
  );
  const actions = useMemo(() => ({ set, remove }), [set, remove]);
  const top = entries[entries.length - 1];
  return (
    <ActionsContext.Provider value={actions}>
      <OpenContext.Provider value={!!top}>
        <View style={styles.fill} importantForAccessibility={top ? 'no-hide-descendants' : 'auto'}>
          {children}
        </View>
        {top ? (
          <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
            {top.node}
          </View>
        ) : null}
      </OpenContext.Provider>
    </ActionsContext.Provider>
  );
}

export function useSheetApi(): Actions {
  const api = useContext(ActionsContext);
  if (!api) throw new Error('BottomSheet must be rendered inside <SheetHost> (mounted in src/app/_layout.tsx).');
  return api;
}

export const useSheetOpen = () => useContext(OpenContext);

const styles = StyleSheet.create({ fill: { flex: 1 } });
