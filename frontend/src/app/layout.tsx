import './globals.css';
import type { Metadata } from 'next';

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
      <body>{children}</body>
    </html>
  );
}