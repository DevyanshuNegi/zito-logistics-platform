import type { Metadata } from 'next';
import { WarehousingPage } from '@/components/public-site/PublicSite';

export const metadata: Metadata = {
  title: 'Warehousing Ecosystem | ZITO',
  description:
    'ZITO warehousing ecosystem for inventory movement, warehouse operations, cargo management, and logistics handoffs.',
};

export default function Warehousing() {
  return <WarehousingPage />;
}
