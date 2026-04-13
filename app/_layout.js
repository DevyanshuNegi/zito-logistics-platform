// app/_layout.js
import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from '../src/context/AuthContext';
import { View, ActivityIndicator } from 'react-native';
import { colors } from '../src/constants/theme';

function RootGuard() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (loading) return;

    const inAuth = segments[0] === '(auth)';

    if (!user && !inAuth) {
      router.replace('/(auth)/login');
      return;
    }

    if (user && inAuth) {
      // Redirect to correct portal based on role
      switch (user.role) {
        case 'driver':       router.replace('/(driver)/trips');       break;
        case 'transporter':  router.replace('/(transporter)/dashboard'); break;
        case 'customer':
        default:             router.replace('/(customer)/home');      break;
      }
    }
  }, [user, loading, segments]);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
      <Stack.Screen name="(auth)"        options={{ headerShown: false }} />
      <Stack.Screen name="(driver)"      options={{ headerShown: false }} />
      <Stack.Screen name="(customer)"    options={{ headerShown: false }} />
      <Stack.Screen name="(transporter)" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="light" />
      <RootGuard />
    </AuthProvider>
  );
}
