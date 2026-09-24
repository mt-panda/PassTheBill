import { HeaderHeightContext } from 'expo-router/react-navigation';
import { useContext, type ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  RefreshControl,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MaxContentWidth, screenPadding, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  children: ReactNode;
  scroll?: boolean;
  /** true on Stack screens that show the native header (top inset handled by the header). */
  nativeHeader?: boolean;
  /** wrap in a local KeyboardAvoidingView (there is no global one). */
  keyboard?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  /** sticky footer for the primary action; stays above the keyboard when `keyboard` is set. */
  footer?: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
};

export function Screen({
  children,
  scroll = true,
  nativeHeader = false,
  keyboard = false,
  refreshing,
  onRefresh,
  footer,
  contentStyle,
}: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  // KAV measures itself relative to its parent while the keyboard frame is in window coordinates,
  // so screens under a native header must offset by the header height.
  const headerHeight = useContext(HeaderHeightContext) ?? 0;
  const pad = screenPadding(width);
  const body: ViewStyle = {
    paddingHorizontal: pad,
    paddingTop: nativeHeader ? Spacing.lg : insets.top + Spacing.lg,
    paddingBottom: footer ? Spacing.lg : Spacing.xxxl,
    gap: Spacing.lg,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  };
  const content = scroll ? (
    <ScrollView
      style={{ flex: 1 }}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={[body, contentStyle]}
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={!!refreshing}
            onRefresh={onRefresh}
            colors={[theme.primary]}
            progressBackgroundColor={theme.backgroundElement}
          />
        ) : undefined
      }>
      {children}
    </ScrollView>
  ) : (
    <View style={[{ flex: 1 }, body, contentStyle]}>{children}</View>
  );
  const inner = (
    <>
      {content}
      {footer && (
        <View
          style={[
            styles.footer,
            {
              paddingHorizontal: pad,
              paddingBottom: insets.bottom + Spacing.md,
              backgroundColor: theme.background,
              borderTopColor: theme.border,
            },
          ]}>
          {footer}
        </View>
      )}
    </>
  );
  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      {keyboard ? (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding" keyboardVerticalOffset={nativeHeader ? headerHeight : 0}>
          {inner}
        </KeyboardAvoidingView>
      ) : (
        inner
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  footer: { paddingTop: Spacing.md, borderTopWidth: StyleSheet.hairlineWidth, gap: Spacing.sm },
});
