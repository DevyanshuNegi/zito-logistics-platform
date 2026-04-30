import type { ReactNode } from 'react';
import { PortalShell } from '@/components/layout/PortalShell';

const navItems = [
  { href: '/customer/bookings', label: 'My Bookings' },
  { href: '/customer/bookings/new', label: 'Book a Trip' },
  { href: '/customer/fleet', label: 'Owned Fleet' },
  { href: '/customer/payments', label: 'Payments' },
  { href: '/customer/invoices', label: 'Invoices' },
  { href: '/customer/support', label: 'Support' },
  { href: '/customer/profile', label: 'Profile' },
];

export default function CustomerLayout({ children }: { children: ReactNode }) {
  return (
    <PortalShell title="Customer Portal" allowedRoles={['CUSTOMER']} navItems={navItems}>
      {children}
    </PortalShell>
  );
}
