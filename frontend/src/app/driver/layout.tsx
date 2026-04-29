import type { ReactNode } from 'react';
import { PortalShell } from '@/components/layout/PortalShell';

const navItems = [
  { href: '/driver/dashboard', label: 'Dashboard' },
  { href: '/driver/jobs', label: 'Jobs' },
  { href: '/driver/shift', label: 'Shift' },
  { href: '/driver/earnings', label: 'Earnings' },
];

export default function DriverLayout({ children }: { children: ReactNode }) {
  return (
    <PortalShell title="Driver Console" allowedRoles={['DRIVER']} navItems={navItems}>
      {children}
    </PortalShell>
  );
}
