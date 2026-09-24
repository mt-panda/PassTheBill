import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { reportError } from '@/lib/errors';

import { Button } from './button';
import { Icon } from './icon';

type Props = {
  title?: string;
  message?: string;
  onRetry?: () => void;
  secondary?: { label: string; onPress: () => void };
};

export function ErrorState({ title = 'Something went wrong', message = 'Please try again.', onRetry, secondary }: Props) {
  const theme = useTheme();
  return (
    <View style={styles.wrap} accessibilityLiveRegion="polite">
      <View style={[styles.icon, { backgroundColor: theme.warningSoft }]}>
        <Icon name="info" size={28} color="warningText" />
      </View>
      <ThemedText type="sectionTitle" style={{ textAlign: 'center' }}>
        {title}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center', maxWidth: 300 }}>
        {message}
      </ThemedText>
      {onRetry && <Button title="Try again" onPress={onRetry} style={{ alignSelf: 'stretch', marginTop: Spacing.sm }} />}
      {secondary && <Button title={secondary.label} variant="ghost" onPress={secondary.onPress} style={{ alignSelf: 'stretch' }} />}
    </View>
  );
}

/** Exported from every route file as `ErrorBoundary`, so a render crash shows this instead of killing the app. */
export function RouteErrorBoundary({ error, retry }: { error: Error; retry: () => Promise<void> }) {
  const theme = useTheme();
  useEffect(() => reportError('route', error), [error]);
  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: Spacing.xl, backgroundColor: theme.background }}>
      <ErrorState onRetry={() => void retry()} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: Spacing.sm, paddingVertical: 48 },
  icon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
});
