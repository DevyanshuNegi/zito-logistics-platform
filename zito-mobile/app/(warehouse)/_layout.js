import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../src/constants/theme';

const TabIcon = ({ name, color }) => <Ionicons name={name} size={20} color={color} />;

export default function WarehouseLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.tabBar,
          borderTopColor: colors.border,
          height: 64,
          paddingBottom: 8,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textFaint,
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{ title: 'Dashboard', tabBarIcon: ({ color }) => <TabIcon name="grid-outline" color={color} /> }}
      />
      <Tabs.Screen
        name="inventory"
        options={{ title: 'Inventory', tabBarIcon: ({ color }) => <TabIcon name="cube-outline" color={color} /> }}
      />
      <Tabs.Screen
        name="opportunities"
        options={{ title: 'Market', tabBarIcon: ({ color }) => <TabIcon name="briefcase-outline" color={color} /> }}
      />
      <Tabs.Screen
        name="support"
        options={{ title: 'Support', tabBarIcon: ({ color }) => <TabIcon name="chatbubbles-outline" color={color} /> }}
      />
    </Tabs>
  );
}
