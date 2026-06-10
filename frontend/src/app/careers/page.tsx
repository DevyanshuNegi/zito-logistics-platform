import type { Metadata } from 'next';
import { CareersPage } from '@/components/public-site/PublicSite';

export const metadata: Metadata = {
  title: 'Careers at ZITO | Logistics Technology',
  description:
    'Join ZITO to build logistics technology, operational systems, data products, and African infrastructure expansion.',
};

export default function Careers() {
  return <CareersPage />;
}
