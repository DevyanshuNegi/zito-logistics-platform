import type { Metadata } from 'next';
import { ServicesPage } from '@/components/public-site/PublicSite';

export const metadata: Metadata = {
  title: 'ZITO Services | Logistics Ecosystem',
  description:
    'Explore ZITO services across logistics management, courier operations, transporter marketplace, warehousing, tracking, fleet operations, and enterprise delivery.',
};

export default function Services() {
  return <ServicesPage />;
}
