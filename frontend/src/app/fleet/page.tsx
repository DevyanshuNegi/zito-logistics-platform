import type { Metadata } from 'next';
import { FleetPage } from '@/components/public-site/PublicSite';

export const metadata: Metadata = {
  title: 'Fleet Management | ZITO',
  description:
    'ZITO fleet management for transporters, drivers, GPS tracking, route operations, and fleet earnings.',
};

export default function Fleet() {
  return <FleetPage />;
}
