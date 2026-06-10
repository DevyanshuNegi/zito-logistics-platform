import type { Metadata } from 'next';
import { PlatformPage } from '@/components/public-site/PublicSite';

export const metadata: Metadata = {
  title: 'ZITO Platform Ecosystem | Apps and Operations',
  description:
    'Explore the ZITO platform ecosystem for customers, transporters, drivers, operations teams, and admin control.',
};

export default function Platform() {
  return <PlatformPage />;
}
