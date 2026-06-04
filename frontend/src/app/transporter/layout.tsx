import type { ReactNode } from 'react';
import { PortalShell } from '@/components/layout/PortalShell';

const navItems = [
  { href: '/transporter/fleet', label: 'Fleet' },
  { href: '/transporter/marketplace', label: 'Marketplace' },
  { href: '/transporter/invoices', label: 'Invoices' },
];

export default function TransporterLayout({ children }: { children: ReactNode }) {
  return (
    <PortalShell
      title="Transporter Hub"
      allowedRoles={['TRANSPORTER', 'ADMIN', 'SUPER_ADMIN']}
      navItems={navItems}
    >
      {children}
    </PortalShell>
  );
}
