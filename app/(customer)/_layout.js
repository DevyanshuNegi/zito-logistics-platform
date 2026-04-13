// app/(customer)/_layout.js
import { Tabs } from 'expo-router';
import { colors } from '../../src/constants/theme';
import { Text } from 'react-native';

const Ico = ({ e, focused }) => <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.45 }}>{e}</Text>;

export default function CustomerLayout() {
  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarStyle: { backgroundColor: '#0b0e16', borderTopColor: 'rgba(255,255,255,0.06)', height: 64, paddingBottom: 8 },
      tabBarActiveTintColor: colors.primary,
      tabBarInactiveTintColor: colors.textFaint,
      tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
    }}>
      <Tabs.Screen name="home"    options={{ title: 'Home',    tabBarIcon: ({ focused }) => <Ico e="🏠" focused={focused} /> }} />
      <Tabs.Screen name="book"    options={{ title: 'Book',    tabBarIcon: ({ focused }) => <Ico e="📦" focused={focused} /> }} />
      <Tabs.Screen name="track"   options={{ title: 'Track',   tabBarIcon: ({ focused }) => <Ico e="🛰️" focused={focused} /> }} />
      <Tabs.Screen name="history" options={{ title: 'History', tabBarIcon: ({ focused }) => <Ico e="📋" focused={focused} /> }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: ({ focused }) => <Ico e="👤" focused={focused} /> }} />
    </Tabs>
  );
}
