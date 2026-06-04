// app/_layout.js
import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from '../src/context/AuthContext';
import { ActivityIndicator, ImageBackground, StyleSheet, View } from 'react-native';
import { colors } from '../src/constants/theme';

const SPLASH_SOURCE = require('../assets/images/zito-original-logo-splash-screen.png');

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
      <ImageBackground source={SPLASH_SOURCE} style={styles.splashScreen} resizeMode="cover">
        <View style={styles.splashLoader}>
          <ActivityIndicator color="#14bfff" size="small" />
        </View>
      </ImageBackground>
    );
  }

  return (
    <Stack 
      screenOptions={{ 
        headerShown: false, 
        contentStyle: { backgroundColor: colors.bg },
        animationEnabled: false 
      }}
    >
      <Stack.Screen name="(auth)"        options={{ headerShown: false, gestureEnabled: false }} />
      <Stack.Screen name="(agent)"       options={{ headerShown: false, gestureEnabled: true }} />
      <Stack.Screen name="(driver)"      options={{ headerShown: false, gestureEnabled: true }} />
      <Stack.Screen name="(customer)"    options={{ headerShown: false, gestureEnabled: true }} />
      <Stack.Screen name="(courier-company)" options={{ headerShown: false, gestureEnabled: true }} />
      <Stack.Screen name="(transporter)" options={{ headerShown: false, gestureEnabled: true }} />
      <Stack.Screen name="(warehouse)"   options={{ headerShown: false, gestureEnabled: true }} />
      <Stack.Screen name="(internal)"    options={{ headerShown: false, gestureEnabled: true }} />
      <Stack.Screen name="(agency)"      options={{ headerShown: false, gestureEnabled: true }} />
    </Stack>
  );
}

const styles = StyleSheet.create({
  splashScreen: {
    flex: 1,
    backgroundColor: '#000000',
  },
  splashLoader: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 90,
    alignItems: 'center',
  },
});

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="light" />
      <RootGuard />
    </AuthProvider>
  );
}
