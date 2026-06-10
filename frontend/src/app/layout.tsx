import './globals.css';
import type { Metadata } from 'next';
import { AuthProvider } from '@/contexts/AuthContext';
import { AppPreferencesProvider } from '@/contexts/AppPreferencesContext';
import { BRAND } from '@/lib/brand';

export const metadata: Metadata = {
  title: BRAND.appName,
  description: BRAND.appDescription,
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: BRAND.appName,
  },
  icons: {
    // Primary favicon for browser tabs
    icon: [
      {
        url: '/favicon-48.png',
        sizes: '48x48',
        type: 'image/png',
      },
      {
        url: '/favicon-96.png',
        sizes: '96x96',
        type: 'image/png',
      },
      {
        url: '/favicon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        url: '/zito-app-icon.png',
        sizes: 'any',
        type: 'image/png',
      },
    ],
    // Apple device icon
    apple: [
      {
        url: '/favicon-96.png',
        sizes: '96x96',
        type: 'image/png',
      },
    ],
    // Shortcut icon for bookmarks
    shortcut: '/favicon-48.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <AppPreferencesProvider>{children}</AppPreferencesProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
