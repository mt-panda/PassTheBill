import { Tabs, router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';

const tabIcon =
  (name: IconName) =>
  ({ focused }: { focused: boolean }) => <Icon name={name} size={22} color={focused ? 'primary' : 'textSecondary'} />;

function NewOrderButton() {
  const theme = useTheme();
  return (
    <View style={styles.newSlot}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="New order"
        onPress={() => router.push('/order-form')}
        style={({ pressed }) => [
          styles.newButton,
          { backgroundColor: theme.primary, borderColor: theme.backgroundElement },
          pressed && { transform: [{ scale: 0.94 }], opacity: 0.9 },
        ]}>
        <Icon name="add" size={28} color="onPrimary" />
      </Pressable>
    </View>
  );
}

export default function TabsLayout() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        animation: 'shift',
        sceneStyle: { backgroundColor: theme.background },
        headerStyle: { backgroundColor: theme.background },
        headerShadowVisible: false,
        headerTintColor: theme.text,
        headerTitleStyle: { fontWeight: '600' },
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.textSecondary,
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
        tabBarStyle: {
          backgroundColor: theme.backgroundElement,
          borderTopColor: theme.border,
          borderTopWidth: StyleSheet.hairlineWidth,
          height: 72 + insets.bottom,
          paddingTop: 6,
          paddingBottom: insets.bottom + 6,
        },
      }}>
      <Tabs.Screen name="index" options={{ title: 'Orders', headerShown: false, tabBarIcon: tabIcon('home') }} />
      <Tabs.Screen name="totals" options={{ title: 'Monthly totals', tabBarLabel: 'Totals', tabBarIcon: tabIcon('chart') }} />
      <Tabs.Screen name="new" options={{ title: 'New order', tabBarButton: () => <NewOrderButton /> }} />
      <Tabs.Screen name="team" options={{ title: 'Team', tabBarIcon: tabIcon('people') }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarIcon: tabIcon('settings') }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  newSlot: { flex: 1, alignItems: 'center' },
  newButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginTop: -22,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
});
