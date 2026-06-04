import { Redirect } from 'expo-router';
import { ActivityIndicator, ImageBackground, StyleSheet, View } from 'react-native';
import { useAuth } from '../src/context/AuthContext';

const SPLASH_SOURCE = require('../assets/images/zito-original-logo-splash-screen.png');

export default function AppIndex() {
  const { loading } = useAuth();

  if (loading) {
    return (
      <ImageBackground source={SPLASH_SOURCE} style={styles.splashScreen} resizeMode="cover">
        <View style={styles.splashLoader}>
          <ActivityIndicator color="#14bfff" size="small" />
        </View>
      </ImageBackground>
    );
  }

  // Always redirect to auth/login - RootGuard in _layout.js will handle role-based navigation
  return <Redirect href="/(auth)/login" />;
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
