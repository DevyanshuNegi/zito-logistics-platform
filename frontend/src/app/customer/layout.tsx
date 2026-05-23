import type { ReactNode } from 'react';
import { CustomerShell } from '@/components/layout/CustomerShell';

const navItems = [
  { href: '/customer/bookings', label: 'Home' },
  { href: '/customer/bookings/new', label: 'Book' },
  { href: '/customer/warehouse', label: 'Warehouse' },
  { href: '/customer/tracking', label: 'Track' },
  { href: '/customer/payments', label: 'Payments' },
  { href: '/customer/support', label: 'Support' },
  { href: '/customer/profile', label: 'Account' },
];

const mobileNavItems = [
  { href: '/customer/bookings', label: 'Home' },
  { href: '/customer/bookings/new', label: 'Book' },
  { href: '/customer/warehouse', label: 'Warehouse' },
  { href: '/customer/tracking', label: 'Track' },
  { href: '/customer/profile', label: 'Account' },
];

export default function CustomerLayout({ children }: { children: ReactNode }) {
  return (
    <CustomerShell
      title="Zito Logistics"
      allowedRoles={['CUSTOMER']}
      navItems={navItems}
      mobileNavItems={mobileNavItems}
    >
      {children}
    </CustomerShell>
  );
}
