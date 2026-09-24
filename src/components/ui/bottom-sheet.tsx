import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { BackHandler, KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { Button } from './button';
import { IconButton } from './icon-button';
import { useSheetApi } from './sheet-host';

function resolveCloseRequest(s: {
  dismissible: boolean;
  confirmDiscard: boolean;
  asking: boolean;
}): 'ignore' | 'ask' | 'close' {
  if (!s.dismissible) return 'ignore';
  if (s.confirmDiscard && !s.asking) return 'ask';
  return 'close';
}

type Props = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  onBack?: () => void;
  /** false while saving: back and backdrop are ignored. */
  dismissible?: boolean;
  /** true when the form has input: back/backdrop first ask "Discard changes?". */
  confirmDiscard?: boolean;
  /** inline error shown above the footer (toasts render under sheets). */
  error?: string | null;
  footer?: ReactNode;
  children: ReactNode;
};

let nextId = 1;

export function BottomSheet({
  visible,
  onClose,
  title,
  onBack,
  dismissible = true,
  confirmDiscard = false,
  error,
  footer,
  children,
}: Props) {
  const api = useSheetApi();
  const [id] = useState(() => nextId++);
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [asking, setAsking] = useState(false);
  // Reset the discard prompt whenever the sheet is hidden (render-time reset, not an effect).
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (!visible) setAsking(false);
  }

  const requestClose = () => {
    const decision = resolveCloseRequest({ dismissible, confirmDiscard, asking });
    if (decision === 'ask') setAsking(true);
    if (decision === 'close') {
      setAsking(false);
      onClose();
    }
  };
  // Android back: dismiss the discard prompt, else step back, else close.
  const hardwareBack = () => {
    if (!dismissible) return;
    if (asking) return setAsking(false);
    if (onBack) return onBack();
    requestClose();
  };
  const hardwareBackRef = useRef(hardwareBack);
  useEffect(() => {
    hardwareBackRef.current = hardwareBack;
  });

  useEffect(() => {
    if (!visible) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      hardwareBackRef.current();
      return true;
    });
    return () => sub.remove();
  }, [visible]);

  const node = visible ? (
    <KeyboardAvoidingView behavior="padding" style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View
        entering={FadeIn.duration(180)}
        exiting={FadeOut.duration(160)}
        style={[StyleSheet.absoluteFill, { backgroundColor: theme.scrim }]}>
        <Pressable accessibilityLabel="Close sheet" accessibilityRole="button" style={StyleSheet.absoluteFill} onPress={requestClose} />
      </Animated.View>
      <View style={styles.bottom} pointerEvents="box-none">
        <Animated.View
          entering={SlideInDown.duration(220)}
          exiting={SlideOutDown.duration(180)}
          accessibilityViewIsModal
          style={[styles.sheet, { backgroundColor: theme.backgroundElement, paddingBottom: insets.bottom + Spacing.lg }]}>
          <View style={[styles.grabber, { backgroundColor: theme.border }]} />
          {(title || onBack) && (
            <View style={styles.header}>
              {onBack && <IconButton icon="back" label="Back" onPress={onBack} size={36} />}
              {title && (
                <ThemedText type="sectionTitle" accessibilityRole="header" numberOfLines={1} style={{ flex: 1 }}>
                  {title}
                </ThemedText>
              )}
            </View>
          )}
          {asking ? (
            <View style={{ gap: Spacing.md }}>
              <ThemedText type="bodyStrong">Discard changes?</ThemedText>
              <Button title="Keep editing" variant="secondary" onPress={() => setAsking(false)} />
              <Button title="Discard" variant="danger" onPress={requestClose} />
            </View>
          ) : (
            <>
              <ScrollView style={{ flexGrow: 0 }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: Spacing.lg }}>
                {children}
              </ScrollView>
              {error ? (
                <ThemedText type="small" themeColor="danger" accessibilityLiveRegion="polite">
                  {error}
                </ThemedText>
              ) : null}
              {footer ? <View style={{ gap: Spacing.sm }}>{footer}</View> : null}
            </>
          )}
        </Animated.View>
      </View>
    </KeyboardAvoidingView>
  ) : null;

  // Push the latest render of this sheet into the host on every render; remove it when hidden or unmounted.
  useLayoutEffect(() => {
    if (node) api.set(id, node);
    else api.remove(id);
  });
  useEffect(() => () => api.remove(id), [api, id]);

  return null;
}

const styles = StyleSheet.create({
  bottom: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    maxHeight: '90%',
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.sm,
    gap: Spacing.lg,
  },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2 },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
});
