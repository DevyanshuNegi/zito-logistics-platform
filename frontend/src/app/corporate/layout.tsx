import type { ReactNode } from 'react';
import { PortalShell } from '@/components/layout/PortalShell';

const navItems = [
  { href: '/corporate/bookings', label: 'Bookings' },
  { href: '/corporate/invoices', label: 'Invoices' },
  { href: '/corporate/contracts', label: 'Contracts' },
];

export default function CorporateLayout({ children }: { children: ReactNode }) {
  return (
    <PortalShell title="Corporate Portal" allowedRoles={['CORPORATE']} navItems={navItems}>
      {children}
    </PortalShell>
  );
}
