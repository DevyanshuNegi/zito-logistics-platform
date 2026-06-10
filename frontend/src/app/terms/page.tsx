import type { Metadata } from 'next';
import { LegalPage } from '@/components/public-site/PublicSite';

export const metadata: Metadata = {
  title: 'Terms and Conditions | ZITO',
  description:
    'Terms and conditions for ZITO platform users, logistics partners, drivers, customers, and enterprise accounts.',
};

export default function Terms() {
  return <LegalPage kind="terms" />;
}
