import type { ReactNode } from 'react';
import { PortalShell } from '@/components/layout/PortalShell';

const navItems = [
  { href: '/agent/dashboard', label: 'Dashboard' },
  { href: '/agent/fleet', label: 'Fleet' },
  { href: '/agent/drivers', label: 'Drivers' },
  { href: '/agent/marketplace', label: 'Marketplace' },
];

export default function AgentLayout({ children }: { children: ReactNode }) {
  return (
    <PortalShell
      title="Agent Network"
      allowedRoles={['AGENT', 'ADMIN', 'SUPER_ADMIN']}
      navItems={navItems}
    >
      {children}
    </PortalShell>
  );
}
