import type { Metadata } from 'next';
import { LegalPage } from '@/components/public-site/PublicSite';

export const metadata: Metadata = {
  title: 'Compliance and NDA Readiness | ZITO',
  description:
    'ZITO compliance and NDA readiness for protected platform architecture, access control, intellectual property, and enterprise governance.',
};

export default function Compliance() {
  return <LegalPage kind="compliance" />;
}
