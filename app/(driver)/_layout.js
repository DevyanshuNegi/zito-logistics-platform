// app/(driver)/_layout.js
import { Tabs } from 'expo-router';
import { colors } from '../../src/constants/theme';
import { Text } from 'react-native';

const Ico = ({ e, focused }) => (
  <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.45 }}>{e}</Text>
);

export default function DriverLayout() {
  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarStyle: { backgroundColor: '#0b0e16', borderTopColor: 'rgba(255,255,255,0.06)', height: 64, paddingBottom: 8 },
      tabBarActiveTintColor: colors.primary,
      tabBarInactiveTintColor: colors.textFaint,
      tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
    }}>
      <Tabs.Screen name="trips"       options={{ title: 'My Trips',    tabBarIcon: ({ focused }) => <Ico e="📋" focused={focused} /> }} />
      <Tabs.Screen name="marketplace" options={{ title: 'Loads',       tabBarIcon: ({ focused }) => <Ico e="🛲" focused={focused} /> }} />
      <Tabs.Screen name="earnings"    options={{ title: 'Earnings',    tabBarIcon: ({ focused }) => <Ico e="💰" focused={focused} /> }} />
      <Tabs.Screen name="sos"         options={{ title: 'SOS',         tabBarIcon: ({ focused }) => <Ico e="🆘" focused={focused} />, tabBarActiveTintColor: colors.danger }} />
      <Tabs.Screen name="profile"     options={{ title: 'Profile',     tabBarIcon: ({ focused }) => <Ico e="👤" focused={focused} /> }} />
    </Tabs>
  );
}
