import './globals.css';
import type { Metadata } from 'next';
import { AuthProvider } from '@/contexts/AuthContext';
import { AppPreferencesProvider } from '@/contexts/AppPreferencesContext';

export const metadata: Metadata = {
  title: 'ZITO - Logistics Super-App',
  description: 'ZITO is an asset-less, next-generation logistics super-app.',
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
