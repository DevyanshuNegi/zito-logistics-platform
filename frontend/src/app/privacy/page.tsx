import type { Metadata } from 'next';
import { LegalPage } from '@/components/public-site/PublicSite';

export const metadata: Metadata = {
  title: 'Privacy Policy | ZITO',
  description:
    'Privacy policy for ZITO, the logistics technology platform operated by Zito Tech Africa Limited.',
};

export default function Privacy() {
  return <LegalPage kind="privacy" />;
}
