import type { ReactNode } from 'react';
import { PortalShell } from '@/components/layout/PortalShell';

const navItems = [
  { href: '/staff/operations', label: 'Operations' },
  { href: '/staff/support', label: 'Customer Care' },
  { href: '/staff/accounts', label: 'Accounts' },
];

export default function StaffLayout({ children }: { children: ReactNode }) {
  return (
    <PortalShell
      title="Head Office Desk"
      allowedRoles={['AGENCY_STAFF', 'ADMIN', 'SUPER_ADMIN']}
      allowedStaffScopes={['HEAD_OFFICE']}
      navItems={navItems}
      workspaceLabel="Head office operations"
      headerEyebrow="Head office teams"
      headerDescription="Operations, customer care, and finance workspaces."
      headerTitleMode="section"
    >
      {children}
    </PortalShell>
  );
}
