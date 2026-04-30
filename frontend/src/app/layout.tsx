import './globals.css';
import type { Metadata } from 'next';
import { AuthProvider } from '@/contexts/AuthContext';
import { AppPreferencesProvider } from '@/contexts/AppPreferencesContext';
import { BRAND } from '@/lib/brand';

export const metadata: Metadata = {
  title: `${BRAND.appName} | ${BRAND.companyName}`,
  description: BRAND.appDescription,
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
