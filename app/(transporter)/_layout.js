// app/(transporter)/_layout.js
import { Tabs } from 'expo-router';
import { colors } from '../../src/constants/theme';
import { Text } from 'react-native';

const Ico = ({ e, focused }) => <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.45 }}>{e}</Text>;

export default function TransporterLayout() {
  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarStyle: { backgroundColor: '#0b0e16', borderTopColor: 'rgba(255,255,255,0.06)', height: 64, paddingBottom: 8 },
      tabBarActiveTintColor: colors.primary,
      tabBarInactiveTintColor: colors.textFaint,
      tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
    }}>
      <Tabs.Screen name="dashboard" options={{ title: 'Dashboard', tabBarIcon: ({ focused }) => <Ico e="📊" focused={focused} /> }} />
      <Tabs.Screen name="fleet"     options={{ title: 'Fleet',     tabBarIcon: ({ focused }) => <Ico e="🚚" focused={focused} /> }} />
      <Tabs.Screen name="drivers"   options={{ title: 'Drivers',   tabBarIcon: ({ focused }) => <Ico e="👤" focused={focused} /> }} />
      <Tabs.Screen name="bookings"  options={{ title: 'Bookings',  tabBarIcon: ({ focused }) => <Ico e="📋" focused={focused} /> }} />
      <Tabs.Screen name="finance"   options={{ title: 'Finance',   tabBarIcon: ({ focused }) => <Ico e="💰" focused={focused} /> }} />
      <Tabs.Screen name="profile"  options={{ title: 'Profile',   tabBarIcon: ({ focused }) => <Ico e="👤" focused={focused} /> }} />
    </Tabs>
  );
}
