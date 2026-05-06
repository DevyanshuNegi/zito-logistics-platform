// src/constants/flavors.ts
// Multi-flavor app configuration (Customer, Partner, Admin)

import { useColorScheme } from 'react-native';

export type AppFlavor = 'customer' | 'partner' | 'admin';

// Get current app flavor from app.json extra.appFlavor
export const getAppFlavor = (): AppFlavor => {
  const flavor = process.env.EXPO_PUBLIC_APP_FLAVOR || process.env.APP_FLAVOR;
  return (flavor || 'customer') as AppFlavor;
};

export const FLAVOR_CONFIG: Record<AppFlavor, {
  name: string;
  appId: string;
  deepLinkScheme: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  targetUsers: string;
  features: string[];
  defaultRoute: string;
  description: string;
}> = {
  customer: {
    name: 'Zito Customer',
    appId: 'com.aurenza.zito.customer',
    deepLinkScheme: 'zito-customer://',
    primaryColor: '#0066FF', // Blue
    secondaryColor: '#E6F4FE',
    accentColor: '#FF6B35',
    backgroundColor: '#FFFFFF',
    targetUsers: 'Customers booking shipments',
    features: [
      'Book shipments',
      'Track deliveries',
      'Manage fleet',
      'Payment processing',
      'Multi-country support',
      'Real-time notifications',
    ],
    defaultRoute: '/(customer)/home',
    description: 'Zito Customer App - Book and track shipments across Africa',
  },
  partner: {
    name: 'Zito Partner',
    appId: 'com.aurenza.zito.partner',
    deepLinkScheme: 'zito-partner://',
    primaryColor: '#FF9500', // Orange
    secondaryColor: '#FFF3E0',
    accentColor: '#D45113',
    backgroundColor: '#FAFAFA',
    targetUsers: 'Drivers, Transporters, Couriers, Warehouses',
    features: [
      'Accept jobs/trips',
      'Route optimization',
      'Proof of delivery',
      'Earnings tracking',
      'Performance metrics',
      'Real-time updates',
    ],
    defaultRoute: '/(driver)/trips',
    description: 'Zito Partner App - Manage deliveries and earn across Africa',
  },
  admin: {
    name: 'Zito Admin',
    appId: 'com.aurenza.zito.admin',
    deepLinkScheme: 'zito-admin://',
    primaryColor: '#9C27B0', // Purple
    secondaryColor: '#F3E5F5',
    accentColor: '#6A1B9A',
    backgroundColor: '#FAFAFA',
    targetUsers: 'Platform admins and managers',
    features: [
      'Dashboard analytics',
      'User management',
      'Network monitoring',
      'Payment reconciliation',
      'Support tickets',
      'Compliance reports',
    ],
    defaultRoute: '/(internal)/dashboard',
    description: 'Zito Admin App - Manage platform and network',
  },
};

export const currentFlavor = getAppFlavor();
export const flavorConfig = FLAVOR_CONFIG[currentFlavor];

// Color scheme hook that respects flavor branding
export const useFlavorsTheme = () => {
  const scheme = useColorScheme();
  
  return {
    flavor: currentFlavor,
    config: flavorConfig,
    isDark: scheme === 'dark',
    colors: {
      primary: flavorConfig.primaryColor,
      secondary: flavorConfig.secondaryColor,
      accent: flavorConfig.accentColor,
      background: scheme === 'dark' ? '#050914' : flavorConfig.backgroundColor,
      text: scheme === 'dark' ? '#FFFFFF' : '#050914',
    },
  };
};

export default FLAVOR_CONFIG;
