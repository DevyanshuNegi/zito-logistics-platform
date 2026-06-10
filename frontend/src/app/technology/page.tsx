import type { Metadata } from 'next';
import { TechnologyPage } from '@/components/public-site/PublicSite';

export const metadata: Metadata = {
  title: 'ZITO Technology | Real-Time Logistics Intelligence',
  description:
    'See how ZITO uses tracking, routing, dashboards, RBAC, APIs, analytics, mobile workflows, and integrations for logistics intelligence.',
};

export default function Technology() {
  return <TechnologyPage />;
}
