import { Tabs } from 'expo-router/js-tabs';
import { StyleSheet, Text, type ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';

export { RouteErrorBoundary as ErrorBoundary } from '@/components/ui';

const tabIcon =
  (name: IconName) =>
  function TabIcon({ color }: { color: ColorValue }) {
    return <Icon name={name} size={24} color={color as string} />;
  };

function TabLabel({ focused, children }: { focused: boolean; children: string }) {
  const theme = useTheme();
  return (
    <Text
      maxFontSizeMultiplier={1.4}
      numberOfLines={1}
      style={{ fontSize: 12, fontWeight: '600', color: focused ? theme.primaryText : theme.textSecondary }}>
      {children}
    </Text>
  );
}

const label =
  (text: string) =>
  function TabBarLabel({ focused }: { focused: boolean }) {
    return <TabLabel focused={focused}>{text}</TabLabel>;
  };

export default function TabsLayout() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        animation: 'shift',
        headerShown: false,
        sceneStyle: { backgroundColor: theme.background },
        headerStyle: { backgroundColor: theme.background },
        headerShadowVisible: false,
        headerTintColor: theme.text,
        headerTitleStyle: { fontWeight: '600' },
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.textSecondary,
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          backgroundColor: theme.backgroundElement,
          borderTopColor: theme.border,
          borderTopWidth: StyleSheet.hairlineWidth,
          // The bottom tab bar forces 49+inset unless height is set; 'auto' lets it grow with the font scale.
          height: 'auto',
          minHeight: 56 + insets.bottom,
          paddingTop: 6,
          paddingBottom: insets.bottom + 6,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{ title: 'Orders', tabBarIcon: tabIcon('orders'), tabBarLabel: label('Orders') }}
      />
      {/* Route name stays 'totals': push notifications deep-link to /totals. */}
      <Tabs.Screen
        name="totals"
        options={{ title: 'My Lunches', tabBarIcon: tabIcon('spending'), tabBarLabel: label('Spending') }}
      />
      <Tabs.Screen name="team" options={{ title: 'Your Team', tabBarIcon: tabIcon('team'), tabBarLabel: label('Team') }} />
      <Tabs.Screen
        name="settings"
        options={{ title: 'Settings', tabBarIcon: tabIcon('settings'), tabBarLabel: label('Settings') }}
      />
    </Tabs>
  );
}
