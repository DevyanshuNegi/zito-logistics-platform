import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../src/constants/theme';

const TabIcon = ({ name, color }) => <Ionicons name={name} size={20} color={color} />;

export default function AgencyLayout() {
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
        name="operations"
        options={{ title: 'Ops', tabBarIcon: ({ color }) => <TabIcon name="construct-outline" color={color} /> }}
      />
      <Tabs.Screen
        name="accounts"
        options={{ title: 'Accounts', tabBarIcon: ({ color }) => <TabIcon name="card-outline" color={color} /> }}
      />
      <Tabs.Screen
        name="support"
        options={{ title: 'Support', tabBarIcon: ({ color }) => <TabIcon name="chatbox-ellipses-outline" color={color} /> }}
      />
    </Tabs>
  );
}
