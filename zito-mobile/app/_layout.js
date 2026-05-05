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
  const role = String(user?.role || '').trim().toUpperCase();
  const staffScope = String(user?.staffScope || '').trim().toUpperCase();

  useEffect(() => {
    if (loading) return;

    const inAuth = segments[0] === '(auth)';

    if (!user && !inAuth) {
      router.replace('/(auth)/login');
      return;
    }

    if (user && inAuth) {
      // Redirect to correct portal based on role
      switch (role) {
        case 'DRIVER':            router.replace('/(driver)/trips'); break;
        case 'AGENT':             router.replace('/(agent)/dashboard'); break;
        case 'TRANSPORTER':       router.replace('/(transporter)/dashboard'); break;
        case 'COURIER_COMPANY':   router.replace('/(courier-company)/dashboard'); break;
        case 'WAREHOUSE_PARTNER': router.replace('/(warehouse)/dashboard'); break;
        case 'ADMIN':
        case 'SUPER_ADMIN':       router.replace('/(internal)/dashboard'); break;
        case 'AGENCY_STAFF':
          router.replace(
            staffScope === 'AGENCY' ? '/(agency)/operations' : '/(internal)/dashboard',
          );
          break;
        case 'CUSTOMER':
        default:                  router.replace('/(customer)/home'); break;
      }
    }
  }, [user, loading, role, segments, router, staffScope]);

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
      <Stack.Screen name="(agent)"       options={{ headerShown: false }} />
      <Stack.Screen name="(driver)"      options={{ headerShown: false }} />
      <Stack.Screen name="(customer)"    options={{ headerShown: false }} />
      <Stack.Screen name="(courier-company)" options={{ headerShown: false }} />
      <Stack.Screen name="(transporter)" options={{ headerShown: false }} />
      <Stack.Screen name="(warehouse)"   options={{ headerShown: false }} />
      <Stack.Screen name="(internal)"    options={{ headerShown: false }} />
      <Stack.Screen name="(agency)"      options={{ headerShown: false }} />
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
