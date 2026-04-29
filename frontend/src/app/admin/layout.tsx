import type { ReactNode } from 'react';
import { PortalShell } from '@/components/layout/PortalShell';

const navItems = [
  { href: '/admin/alerts', label: 'Alerts' },
  { href: '/admin/system-health', label: 'System Health' },
  { href: '/admin/bookings', label: 'Bookings' },
  { href: '/admin/analytics', label: 'Analytics' },
  { href: '/admin/audit', label: 'Audit' },
  { href: '/admin/contracts', label: 'Contracts' },
  { href: '/admin/fraud', label: 'Fraud' },
  { href: '/admin/invoices', label: 'Invoices' },
  { href: '/admin/marketplace', label: 'Marketplace' },
  { href: '/admin/reconciliation', label: 'Reconciliation' },
  { href: '/admin/rate-cards', label: 'Rate Cards' },
  { href: '/admin/staff-performance', label: 'Staff Performance' },
  { href: '/admin/agencies', label: 'Agencies' },
  { href: '/admin/fleet', label: 'Fleet' },
  { href: '/admin/loss-detection', label: 'Loss' },
  { href: '/admin/payments', label: 'Payments' },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <PortalShell title="Admin Command" allowedRoles={['ADMIN', 'SUPER_ADMIN']} navItems={navItems}>
      {children}
    </PortalShell>
  );
}
