import type { Metadata } from 'next';
import { AboutPage } from '@/components/public-site/PublicSite';

export const metadata: Metadata = {
  title: 'About ZITO | Zito Tech Africa Limited',
  description:
    'Learn about Zito Tech Africa Limited, the company building ZITO as an African logistics technology ecosystem.',
};

export default function About() {
  return <AboutPage />;
}
