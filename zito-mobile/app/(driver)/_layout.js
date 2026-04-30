import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../src/constants/theme';

const TabIcon = ({ name, color }) => <Ionicons name={name} size={20} color={color} />;

export default function DriverLayout() {
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
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}>
      <Tabs.Screen
        name="trips"
        options={{ title: 'Trips', tabBarIcon: ({ color }) => <TabIcon name="list-outline" color={color} /> }}
      />
      <Tabs.Screen
        name="earnings"
        options={{ title: 'Earnings', tabBarIcon: ({ color }) => <TabIcon name="wallet-outline" color={color} /> }}
      />
      <Tabs.Screen
        name="sos"
        options={{
          title: 'SOS',
          tabBarActiveTintColor: colors.danger,
          tabBarIcon: ({ color }) => <TabIcon name="warning-outline" color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: 'Profile', tabBarIcon: ({ color }) => <TabIcon name="person-outline" color={color} /> }}
      />
    </Tabs>
  );
}
