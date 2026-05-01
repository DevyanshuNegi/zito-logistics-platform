import type { ReactNode } from 'react';
import { PortalShell } from '@/components/layout/PortalShell';

const navItems = [
  { href: '/courier-company/dispatch', label: 'Dispatch' },
  { href: '/courier-company/bookings', label: 'Load Plans' },
  { href: '/courier-company/bookings/new', label: 'New Movement' },
  { href: '/courier-company/scan', label: 'Scan Ops' },
  { href: '/courier-company/waybills', label: 'Waybills' },
  { href: '/courier-company/fleet', label: 'Owned Fleet' },
  { href: '/courier-company/invoices', label: 'Invoices' },
];

export default function CourierCompanyLayout({ children }: { children: ReactNode }) {
  return (
    <PortalShell
      title="Courier Operations Portal"
      allowedRoles={['COURIER_COMPANY']}
      navItems={navItems}
    >
      {children}
    </PortalShell>
  );
}
