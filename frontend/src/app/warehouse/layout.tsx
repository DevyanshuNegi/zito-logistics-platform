import type { ReactNode } from 'react';
import { PortalShell } from '@/components/layout/PortalShell';

const navItems = [
  { href: '/warehouse/dashboard', label: 'Dashboard' },
  { href: '/warehouse/bins', label: 'Bins' },
  { href: '/warehouse/inventory', label: 'Inventory' },
  { href: '/warehouse/scan', label: 'Scan' },
  { href: '/warehouse/loss-detection', label: 'Loss' },
];

export default function WarehouseLayout({ children }: { children: ReactNode }) {
  return (
    <PortalShell
      title="Warehouse Ops"
      allowedRoles={['WAREHOUSE_PARTNER', 'AGENCY_STAFF', 'ADMIN', 'SUPER_ADMIN']}
      navItems={navItems}
    >
      {children}
    </PortalShell>
  );
}
