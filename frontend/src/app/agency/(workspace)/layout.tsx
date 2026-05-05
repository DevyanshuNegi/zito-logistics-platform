import type { ReactNode } from 'react';
import { PortalShell } from '@/components/layout/PortalShell';

const navItems = [
  { href: '/agency/operations', label: 'Operations' },
  { href: '/agency/support', label: 'Customer Care' },
  { href: '/agency/accounts', label: 'Accounts' },
];

export default function AgencyWorkspaceLayout({ children }: { children: ReactNode }) {
  return (
    <PortalShell
      title="Agency Desk"
      allowedRoles={['AGENCY_STAFF', 'ADMIN', 'SUPER_ADMIN']}
      allowedStaffScopes={['AGENCY']}
      navItems={navItems}
      workspaceLabel="Agency operations"
      headerEyebrow="Agency teams"
      headerDescription="Branch operations, customer care, and accounts desks."
      headerTitleMode="section"
    >
      {children}
    </PortalShell>
  );
}
