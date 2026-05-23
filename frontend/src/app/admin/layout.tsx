import type { ReactNode } from 'react';
import { PortalShell } from '@/components/layout/PortalShell';

const navItems = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/users', label: 'Users & Teams' },
  { href: '/admin/verification', label: 'Verification' },
  { href: '/admin/workforce', label: 'Workforce' },
  { href: '/admin/courier-companies', label: 'Courier Control' },
  { href: '/admin/warehouse-partners', label: 'Warehouse Control' },
  { href: '/admin/warehouse-listings', label: 'Warehouse Listings' },
  { href: '/admin/alerts', label: 'Alerts' },
  { href: '/admin/notifications', label: 'Notifications' },
  { href: '/admin/system-health', label: 'System Health' },
  { href: '/admin/bookings', label: 'Bookings' },
  { href: '/admin/rail-container', label: 'Rail & Container' },
  { href: '/admin/billing', label: 'Billing' },
  { href: '/admin/capacity-planning', label: 'Capacity Planning' },
  { href: '/admin/sla', label: 'SLA' },
  { href: '/admin/surge-pricing', label: 'Surge Pricing' },
  { href: '/admin/heatmap', label: 'Heatmap' },
  { href: '/admin/retention', label: 'Retention' },
  { href: '/admin/route-optimization', label: 'Route Optimization' },
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
    <PortalShell
      title="Admin"
      allowedRoles={['ADMIN', 'SUPER_ADMIN']}
      navItems={navItems}
      workspaceLabel="Control center"
      headerEyebrow="Operations console"
      headerDescription="Live dispatch, controls, and alerts."
      headerTitleMode="section"
      showHeaderBadges
      showSidebarRolePill={false}
      showSidebarHeading={false}
      sidebarBrandCompact={false}
    >
      {children}
    </PortalShell>
  );
}
