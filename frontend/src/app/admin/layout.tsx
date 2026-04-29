import type { ReactNode } from 'react';
import { PortalShell } from '@/components/layout/PortalShell';

const navItems = [
  { href: '/admin/bookings', label: 'Bookings' },
  { href: '/admin/agencies', label: 'Agencies' },
  { href: '/admin/fleet', label: 'Fleet' },
  { href: '/admin/payments', label: 'Payments' },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <PortalShell title="Admin Command" allowedRoles={['ADMIN', 'SUPER_ADMIN']} navItems={navItems}>
      {children}
    </PortalShell>
  );
}
