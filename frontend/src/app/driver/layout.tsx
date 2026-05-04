import type { ReactNode } from 'react';
import { DriverShell } from '@/components/layout/DriverShell';

const mobileNavItems = [
  { href: '/driver/dashboard', label: 'Jobs' },
  { href: '/driver/earnings', label: 'Earnings' },
  { href: '/driver/jobs', label: 'Trips' },
  { href: '/driver/shift', label: 'Profile' },
];

export default function DriverLayout({ children }: { children: ReactNode }) {
  return (
    <DriverShell
      title="Driver app"
      allowedRoles={['DRIVER']}
      mobileNavItems={mobileNavItems}
    >
      {children}
    </DriverShell>
  );
}
