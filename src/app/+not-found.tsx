import { Stack, useRouter } from 'expo-router';

import { EmptyState, Screen } from '@/components/ui';

export { RouteErrorBoundary as ErrorBoundary } from '@/components/ui';

export default function NotFound() {
  const router = useRouter();
  return (
    <>
      <Stack.Screen options={{ title: 'Not found' }} />
      <Screen nativeHeader scroll={false} contentStyle={{ justifyContent: 'center' }}>
        <EmptyState
          icon="info"
          title="This page doesn't exist"
          text="The link may be old or broken."
          action={{ label: 'Go to Orders', onPress: () => router.replace('/') }}
        />
      </Screen>
    </>
  );
}
