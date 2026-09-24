import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { useSheetOpen } from './sheet-host';

const ToastContext = createContext<{ show: (text: string) => void }>({ show: () => {} });
export const useToast = () => useContext(ToastContext);

/** Bottom toast (2 s). Held back while a sheet is open; sheets show success/errors inline instead. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const sheetOpen = useSheetOpen();
  const [pending, setPending] = useState<string | null>(null);
  const [visible, setVisible] = useState<{ text: string; key: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seq = useRef(0);

  const show = useCallback((text: string) => setPending(text), []);

  useEffect(() => {
    if (!pending || sheetOpen) return;
    setVisible({ text: pending, key: ++seq.current });
    setPending(null);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setVisible(null), 2000);
  }, [pending, sheetOpen]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  const api = useMemo(() => ({ show }), [show]);
  return (
    <ToastContext.Provider value={api}>
      {children}
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.anchor, { paddingBottom: insets.bottom + 72 }]}>
        {visible && (
          <Animated.View
            key={visible.key}
            entering={FadeInDown.duration(180)}
            exiting={FadeOutDown.duration(160)}
            accessibilityLiveRegion="polite"
            style={[styles.toast, { backgroundColor: theme.text }]}>
            <ThemedText type="bodyStrong" style={{ color: theme.background }} numberOfLines={2}>
              {visible.text}
            </ThemedText>
          </Animated.View>
        )}
      </View>
    </ToastContext.Provider>
  );
}

const styles = StyleSheet.create({
  anchor: { justifyContent: 'flex-end', alignItems: 'center', paddingHorizontal: Spacing.xl },
  toast: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, borderRadius: Radius.md, maxWidth: 480 },
});
