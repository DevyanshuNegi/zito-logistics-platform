import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../src/constants/theme';

const TabIcon = ({ name, color }) => <Ionicons name={name} size={20} color={color} />;

export default function CustomerLayout() {
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
        name="home"
        options={{ title: 'Home', tabBarIcon: ({ color }) => <TabIcon name="home-outline" color={color} /> }}
      />
      <Tabs.Screen
        name="book"
        options={{ title: 'Book', tabBarIcon: ({ color }) => <TabIcon name="add-circle-outline" color={color} /> }}
      />
      <Tabs.Screen
        name="track"
        options={{ title: 'Track', tabBarIcon: ({ color }) => <TabIcon name="navigate-outline" color={color} /> }}
      />
      <Tabs.Screen
        name="history"
        options={{ title: 'History', tabBarIcon: ({ color }) => <TabIcon name="time-outline" color={color} /> }}
      />
      <Tabs.Screen
        name="fleet"
        options={{ title: 'Fleet', tabBarIcon: ({ color }) => <TabIcon name="car-outline" color={color} /> }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: 'Profile', tabBarIcon: ({ color }) => <TabIcon name="person-outline" color={color} /> }}
      />
    </Tabs>
  );
}
