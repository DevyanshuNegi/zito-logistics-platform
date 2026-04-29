import type { ReactNode } from 'react';
import { PortalShell } from '@/components/layout/PortalShell';

const navItems = [
  { href: '/staff/support', label: 'Support Queue' },
  { href: '/warehouse/dashboard', label: 'Warehouse Ops' },
];

export default function StaffLayout({ children }: { children: ReactNode }) {
  return (
    <PortalShell
      title="Staff Desk"
      allowedRoles={['AGENCY_STAFF', 'ADMIN', 'SUPER_ADMIN']}
      navItems={navItems}
    >
      {children}
    </PortalShell>
  );
}
