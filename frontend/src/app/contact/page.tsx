import type { Metadata } from 'next';
import { ContactPage } from '@/components/public-site/PublicSite';

export const metadata: Metadata = {
  title: 'Contact ZITO | Demo, Partnerships, Support',
  description:
    'Contact ZITO for demos, business inquiries, support, partnerships, transporter onboarding, warehouse integrations, and investor conversations.',
};

export default function Contact() {
  return <ContactPage />;
}
