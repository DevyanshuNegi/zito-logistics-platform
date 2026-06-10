import type { Metadata } from 'next';
import { HomePage } from '@/components/public-site/PublicSite';
import { BRAND } from '@/lib/brand';

export const metadata: Metadata = {
  title: `ZITO | ${BRAND.appTagline}`,
  description:
    "ZITO is the logistics technology ecosystem from Zito Tech Africa Limited, built for Africa's next generation logistics infrastructure.",
};

export default function Home() {
  return <HomePage />;
}
