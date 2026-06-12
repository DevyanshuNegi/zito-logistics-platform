import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Boxes,
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  CloudCog,
  Cpu,
  DatabaseZap,
  Download,
  FileCheck2,
  FileLock2,
  Globe2,
  Handshake,
  Layers3,
  LockKeyhole,
  Mail,
  MapPin,
  Menu,
  MessageCircle,
  Network,
  PackageCheck,
  PanelTop,
  Phone,
  QrCode,
  RadioTower,
  Route,
  Scale,
  Send,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Truck,
  UsersRound,
  Warehouse,
  WalletCards,
  Workflow,
  Zap,
} from 'lucide-react';
import { BRAND } from '@/lib/brand';

type IconCard = {
  title: string;
  description: string;
  icon: LucideIcon;
  meta?: string;
};

type LegalPageProps = {
  kind: 'privacy' | 'terms' | 'compliance';
};

const navLinks = [
  { label: 'Platform', href: '/platform' },
  { label: 'Solutions', href: '/services' },
  { label: 'Fleet', href: '/fleet' },
  { label: 'Warehousing', href: '/warehousing' },
  { label: 'Technology', href: '/technology' },
  { label: 'Company', href: '/about' },
  { label: 'Careers', href: '/careers' },
  { label: 'Contact', href: '/contact' },
];

const logisticsImages = {
  truck:
    'https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?auto=format&fit=crop&w=1200&q=80',
  warehouse:
    'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=1200&q=80',
  fleet:
    'https://images.unsplash.com/photo-1566576721346-d4a3b4eaeb55?auto=format&fit=crop&w=1200&q=80',
};

const publicContact = {
  email: BRAND.publicEmail,
  mobile: '+254 745 759 921',
  address: 'Nairobi, Kenya',
  website: `www.${BRAND.domain}`,
};

const heroMetrics = [
  { label: 'Customer and partner apps', value: '2 apps' },
  { label: 'Fleet and GPS ecosystem', value: 'Live' },
  { label: 'Warehouse coordination', value: 'Connected' },
  { label: 'Africa logistics network', value: 'Scalable' },
];

const operationSignals = [
  ['Shipment ZT-4821', 'Delivered', 'Nairobi to Mombasa'],
  ['Fleet dispatch', 'Active', '24 trucks online'],
  ['Warehouse KE-01', 'Operational', '87% capacity'],
  ['GPS layer', 'Live', 'Route visibility'],
  ['Marketplace', 'Matching', 'Verified partners'],
  ['Support', 'Ready', 'Customer and partner desk'],
];

const bookingFlow = [
  ['01', 'Book shipment', 'Customer app'],
  ['02', 'Match capacity', 'Marketplace'],
  ['03', 'Assign driver', 'Partner app'],
  ['04', 'Track route', 'GPS layer'],
  ['05', 'Warehouse handoff', 'Operations'],
  ['06', 'Proof and payment', 'Customer app'],
];

const marketplaceFlow = [
  ['Post demand', 'Customer or enterprise account creates a shipment with cargo, route, timing, and service needs.'],
  ['Verify supply', 'Transporters, drivers, vehicles, documents, and warehouse capacity stay visible to operations.'],
  ['Control execution', 'GPS, milestones, support, proof, payments, and exceptions stay connected in one workflow.'],
];

const whyZito: IconCard[] = [
  {
    title: 'Apps before admin',
    description:
      'The public ZITO experience starts with mobile booking, live tracking, partner fleet tools, and warehouse visibility.',
    icon: Smartphone,
  },
  {
    title: 'Built for logistics ecosystems',
    description:
      'Customers, transporters, drivers, warehouses, GPS devices, and enterprise logistics teams connect through one platform.',
    icon: Network,
  },
  {
    title: 'Fleet and GPS intelligence',
    description:
      'Vehicle tracking, route visibility, fleet management, driver coordination, and operational status live in the same ecosystem.',
    icon: RadioTower,
  },
  {
    title: 'Africa-first expansion',
    description:
      'ZITO is positioned for Kenya and East Africa expansion across cargo demand, transport supply, warehousing, and partners.',
    icon: Globe2,
  },
];

const ecosystemApps: IconCard[] = [
  {
    title: 'Customer App',
    description: 'Book shipments, track deliveries, manage invoices, request support, and discover warehouse capacity.',
    icon: Smartphone,
    meta: 'Demand',
  },
  {
    title: 'Partner App',
    description: 'Manage fleet, drivers, accepted loads, warehouse work, route operations, earnings, and transport business growth.',
    icon: Truck,
    meta: 'Supply',
  },
  {
    title: 'Driver App',
    description: 'Receive jobs, follow routes, update milestones, capture proof, manage shifts, and report incidents.',
    icon: Route,
    meta: 'Execution',
  },
  {
    title: 'Warehouse Operations',
    description: 'Coordinate storage, inventory movement, shipment visibility, scans, capacity, and facility workflows.',
    icon: Warehouse,
    meta: 'Storage',
  },
  {
    title: 'GPS Fleet Layer',
    description: 'Connect live vehicle tracking, route intelligence, driver movement, and operational visibility.',
    icon: RadioTower,
    meta: 'Tracking',
  },
];

const services: IconCard[] = [
  {
    title: 'Courier services',
    description: 'Book parcels, local deliveries, scheduled shipments, and customer-managed delivery flows from the app.',
    icon: PackageCheck,
  },
  {
    title: 'Trucking network',
    description: 'Connect cargo demand to transporters, trucks, drivers, routes, and verified fleet capacity.',
    icon: Truck,
  },
  {
    title: 'Transporter marketplace',
    description: 'Onboard fleet partners, verify documents, match demand with capacity, and manage partner performance.',
    icon: Handshake,
  },
  {
    title: 'Warehouse operations',
    description: 'Coordinate storage, inventory movement, shipment visibility, scans, and warehouse capacity.',
    icon: Warehouse,
  },
  {
    title: 'Shipment tracking',
    description: 'Track route progress, status history, ETAs, proof of delivery, support issues, and customer visibility.',
    icon: RadioTower,
  },
  {
    title: 'Fleet management',
    description: 'Coordinate vehicles, drivers, earnings, routes, capacity, maintenance, and fleet performance.',
    icon: Truck,
  },
  {
    title: 'Enterprise logistics',
    description: 'Give corporates account-level booking, contracts, invoices, recurring logistics, and operational oversight.',
    icon: Building2,
  },
  {
    title: 'Cargo management',
    description: 'Support cargo handoffs, document-led workflows, route planning, and cross-border operating visibility.',
    icon: Globe2,
  },
  {
    title: 'GPS tracking',
    description: 'Connect live map visibility, route intelligence, vehicle movement, and fleet security signals.',
    icon: RadioTower,
  },
];

const technologyStack: IconCard[] = [
  {
    title: 'Real-time tracking',
    description: 'Live location, milestone events, customer timeline views, route deviation flags, and operational alerts.',
    icon: RadioTower,
  },
  {
    title: 'Smart routing',
    description: 'Route preview, vehicle selection, capacity context, ETA intelligence, and dispatch decision support.',
    icon: Route,
  },
  {
    title: 'Operational dashboard',
    description: 'A control surface for bookings, payments, fraud, verification, support, SLAs, alerts, and performance.',
    icon: BarChart3,
  },
  {
    title: 'Mobile ecosystem',
    description: 'Responsive web and installable PWA-style flows for customers, drivers, partners, and operations teams.',
    icon: Smartphone,
  },
  {
    title: 'RBAC platform',
    description: 'Role-aware access across customers, corporates, drivers, transporters, warehouses, staff, and admins.',
    icon: LockKeyhole,
  },
  {
    title: 'API infrastructure',
    description: 'A service-oriented backend designed for secure integrations, provider switching, and platform scale.',
    icon: CloudCog,
  },
  {
    title: 'Analytics engine',
    description: 'Surface marketplace quality, revenue streams, route health, partner risk, fleet performance, and losses.',
    icon: DatabaseZap,
  },
  {
    title: 'Enterprise integrations',
    description: 'Prepare for payments, maps, document verification, messaging, finance, warehouse, and corporate systems.',
    icon: Layers3,
  },
];

const investorSignals = [
  'Marketplace architecture for customer demand, transporter supply, warehouse capacity, and operational control.',
  'Multiple revenue paths across bookings, marketplace fees, subscriptions, insurance add-ons, warehousing, and enterprise services.',
  'Clear compliance posture through NDAs, data protection language, role access, approvals, and audit-oriented workflows.',
  'Expansion narrative centered on African logistics infrastructure, not single-city courier delivery.',
];

const testimonials = [
  {
    quote:
      'ZITO gives our operations team a single command surface instead of scattered calls, spreadsheets, and status checks.',
    name: 'Regional operations lead',
    role: 'Enterprise shipper',
  },
  {
    quote:
      'The marketplace model is the part that matters. It lets capacity, trust, and performance become measurable.',
    name: 'Fleet partner',
    role: 'Transport network',
  },
  {
    quote:
      'This feels like infrastructure for how African logistics should work: connected, visible, and accountable.',
    name: 'Strategy advisor',
    role: 'Growth and partnerships',
  },
];

const openings = [
  'Platform Engineering',
  'Logistics Operations',
  'Partner Success',
  'Data and Analytics',
  'Enterprise Sales',
  'Compliance and QA',
];

const legalSections = {
  privacy: {
    eyebrow: 'Privacy Policy',
    title: 'Data protection for a logistics intelligence platform.',
    description:
      'Zito Tech Africa Limited collects and protects platform data needed to operate bookings, tracking, payments, verification, support, and logistics visibility.',
    sections: [
      {
        title: 'Data we collect',
        body:
          'Account identity, business profile, contact details, booking records, trip status, payment records, verification documents, support history, device data, and active-trip location data where required.',
      },
      {
        title: 'How data is used',
        body:
          'We use data to deliver logistics services, verify accounts, assign work, track shipments, prevent fraud, process payments, support customers, improve operations, and meet legal obligations.',
      },
      {
        title: 'Location and operational visibility',
        body:
          'Driver and shipment location data is used for active logistics workflows, route visibility, customer updates, safety monitoring, and operational exception handling.',
      },
      {
        title: 'Protection and retention',
        body:
          'The platform is designed around secure access, role controls, encrypted transport, provider governance, audit-oriented records, and retention aligned with operational, tax, and compliance needs.',
      },
      {
        title: 'User rights',
        body:
          'Users may contact ZITO to request access, correction, deletion, portability, objection, or privacy support, subject to legal and operational retention requirements.',
      },
    ],
  },
  terms: {
    eyebrow: 'Terms and Conditions',
    title: 'Operating terms for customers, partners, and platform users.',
    description:
      'These terms describe the responsibilities that keep the ZITO logistics ecosystem reliable, secure, and accountable.',
    sections: [
      {
        title: 'Platform role',
        body:
          'ZITO connects customers, transporters, drivers, warehouses, agents, corporate teams, and operations teams through a logistics technology platform.',
      },
      {
        title: 'Accounts and verification',
        body:
          'Users must provide accurate information, maintain secure credentials, complete required approvals, and keep documents current where their role requires verification.',
      },
      {
        title: 'Bookings and service availability',
        body:
          'Services depend on coverage, partner capacity, route conditions, operational hours, document readiness, and successful dispatch or marketplace assignment.',
      },
      {
        title: 'Payments and records',
        body:
          'Pricing, invoices, refunds, credit terms, and reconciliation may vary by account, contract, service type, and applicable tax or payment-provider requirements.',
      },
      {
        title: 'Liability and prohibited use',
        body:
          'Users must not misuse the platform, share credentials, transport prohibited items, submit fraudulent documents, or use ZITO systems outside authorized logistics activity.',
      },
    ],
  },
  compliance: {
    eyebrow: 'Compliance and NDA Readiness',
    title: 'A practical trust layer for partners, contractors, and enterprise buyers.',
    description:
      'ZITO treats product architecture, data, workflows, infrastructure, APIs, designs, and business operations as protected company assets.',
    sections: [
      {
        title: 'Confidential information',
        body:
          'Source code, infrastructure, APIs, credentials, database access, designs, workflows, product architecture, business plans, customer data, and financial information are confidential.',
      },
      {
        title: 'Access control',
        body:
          'Access to repositories, deployment systems, QA environments, internal documents, APIs, and databases should be granted only for authorized ZITO work and may be revoked.',
      },
      {
        title: 'Restricted activities',
        body:
          'Recipients must not share access, copy credentials, distribute private materials, reproduce platform logic, reverse engineer systems, or use ZITO branding outside approved work.',
      },
      {
        title: 'Intellectual property',
        body:
          'Code, designs, systems, workflows, branding, APIs, infrastructure, and business logic remain the property of Zito Tech Africa Limited.',
      },
      {
        title: 'Governance',
        body:
          'The compliance posture is designed for NDAs, vendor reviews, investor due diligence, privacy review, security hardening, and operational accountability.',
      },
    ],
  },
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

function IconBadge({ icon: Icon, tone = 'dark' }: { icon: LucideIcon; tone?: 'dark' | 'light' }) {
  return (
    <span
      className={cx(
        'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border',
        tone === 'light'
          ? 'border-sky-100 bg-[#f2fbff] text-blue-700'
          : 'border-cyan-300/20 bg-cyan-300/10 text-cyan-200',
      )}
    >
      <Icon className="h-5 w-5" aria-hidden="true" />
    </span>
  );
}

function BrandLockup({ compact = false, inverse = false }: { compact?: boolean; inverse?: boolean }) {
  return (
    <Link href="/" className="group inline-flex min-h-12 items-center gap-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-300">
      <span
        className={cx(
          'relative shrink-0 overflow-hidden rounded-lg border',
          compact ? 'h-10 w-10' : 'h-12 w-12',
          inverse ? 'border-cyan-300/30 bg-slate-950' : 'border-sky-100 bg-slate-950',
        )}
      >
        <Image
          src={BRAND.assets.appIcon}
          alt=""
          fill
          sizes={compact ? '40px' : '48px'}
          className="object-cover"
          priority={!compact}
        />
      </span>
      <span className="flex flex-col leading-none">
        <span
          className={cx(
            'text-lg font-black',
            inverse ? 'bg-gradient-to-r from-cyan-200 via-blue-200 to-fuchsia-200 bg-clip-text text-transparent' : 'text-slate-950',
          )}
        >
          ZITO
        </span>
        <span className={cx('mt-1 text-[11px] font-semibold', inverse ? 'text-slate-300' : 'text-slate-500')}>
          {BRAND.companyName}
        </span>
      </span>
    </Link>
  );
}

function PublicHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0b1424]/95 shadow-xl shadow-slate-950/25 backdrop-blur-xl">
      <nav className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8" aria-label="Public navigation">
        <BrandLockup compact inverse />
        <div className="hidden items-center gap-1 lg:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-300 transition hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-blue-300"
            >
              {link.label}
            </Link>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/coming-soon"
            className="inline-flex min-h-10 items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-[#e9f7ff] px-4 text-sm font-black text-slate-950 shadow-lg shadow-slate-950/20 transition hover:bg-[#d9efff] focus:outline-none focus:ring-2 focus:ring-blue-300"
          >
            Coming soon
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          <details className="relative lg:hidden">
            <summary className="flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-lg border border-white/15 bg-white/10 text-white marker:hidden focus:outline-none focus:ring-2 focus:ring-blue-300">
              <Menu className="h-5 w-5" aria-label="Open navigation" />
            </summary>
            <div className="absolute right-0 mt-3 w-72 rounded-lg border border-white/10 bg-[#0f1b2e] p-2 shadow-2xl shadow-slate-950/30">
              {navLinks.map((link) => (
                <Link key={link.href} href={link.href} className="block rounded-lg px-3 py-3 text-sm font-semibold text-slate-200 hover:bg-white/10">
                  {link.label}
                </Link>
              ))}
            </div>
          </details>
        </div>
      </nav>
    </header>
  );
}

function PublicFooter() {
  const footerGroups = [
    {
      title: 'Quick links',
      links: [
        { label: 'Platform', href: '/platform' },
        { label: 'Solutions', href: '/services' },
        { label: 'Technology', href: '/technology' },
        { label: 'Contact', href: '/contact' },
      ],
    },
    {
      title: 'Platform',
      links: [
        { label: 'Customer App', href: '/coming-soon' },
        { label: 'Partner App', href: '/partners/register' },
        { label: 'Fleet Management', href: '/fleet' },
        { label: 'Warehousing', href: '/warehousing' },
      ],
    },
    {
      title: 'Company',
      links: [
        { label: 'About', href: '/about' },
        { label: 'Careers', href: '/careers' },
        { label: 'Privacy', href: '/privacy' },
        { label: 'Terms', href: '/terms' },
      ],
    },
    {
      title: 'Legal',
      links: [
        { label: 'Compliance', href: '/compliance' },
      ],
    },
  ];

  return (
    <footer className="border-t border-white/10 bg-[#0f1b2e] text-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1fr_1.15fr_0.9fr] lg:px-8">
        <div>
          <BrandLockup inverse />
          <p className="mt-5 max-w-md text-sm leading-6 text-slate-300">
            ZITO is a premium African logistics technology ecosystem for customer apps, fleet operations, GPS tracking, warehousing, and enterprise logistics intelligence.
          </p>
          <div className="mt-6 flex gap-3">
            <a aria-label="LinkedIn" href="https://www.linkedin.com" className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-white/10 text-sm font-black text-cyan-100 transition hover:bg-white/20">
              in
            </a>
            <a aria-label="WhatsApp" href={`https://wa.me/${publicContact.mobile.replace(/\D/g, '')}`} className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-white/10 text-cyan-100 transition hover:bg-white/20">
              <MessageCircle className="h-5 w-5" aria-hidden="true" />
            </a>
            <a aria-label="Email" href={`mailto:${publicContact.email}`} className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-white/10 text-cyan-100 transition hover:bg-white/20">
              <Mail className="h-5 w-5" aria-hidden="true" />
            </a>
          </div>
        </div>
        <div className="grid gap-8 sm:grid-cols-2">
          {footerGroups.map((group) => (
            <div key={group.title}>
              <p className="text-sm font-bold text-white">{group.title}</p>
              <div className="mt-4 space-y-3">
                {group.links.map((link) => (
                  <Link key={link.href} href={link.href} className="block text-sm text-slate-400 transition hover:text-white">
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="rounded-[1.25rem] border border-white/10 bg-white/[0.06] p-5">
          <p className="text-sm font-black uppercase text-cyan-100">Contact details</p>
          <div className="mt-5 space-y-4 text-sm">
            <a href={`tel:${publicContact.mobile.replace(/\s/g, '')}`} className="flex gap-3 text-slate-200 transition hover:text-white">
              <Phone className="mt-0.5 h-4 w-4 shrink-0 text-cyan-200" aria-hidden="true" />
              <span><span className="block text-xs font-bold text-slate-400">Contact Number</span>{publicContact.mobile}</span>
            </a>
            <a href={`mailto:${publicContact.email}`} className="flex gap-3 text-slate-200 transition hover:text-white">
              <Mail className="mt-0.5 h-4 w-4 shrink-0 text-cyan-200" aria-hidden="true" />
              <span><span className="block text-xs font-bold text-slate-400">Email</span>{publicContact.email}</span>
            </a>
            <a href={`https://${publicContact.website}`} className="flex gap-3 text-slate-200 transition hover:text-white">
              <Globe2 className="mt-0.5 h-4 w-4 shrink-0 text-cyan-200" aria-hidden="true" />
              <span><span className="block text-xs font-bold text-slate-400">Website</span>{publicContact.website}</span>
            </a>
            <span className="flex gap-3 text-slate-200">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-cyan-200" aria-hidden="true" />
              <span><span className="block text-xs font-bold text-slate-400">Location</span>{publicContact.address}</span>
            </span>
          </div>
        </div>
      </div>
      <div className="border-t border-white/10 px-4 py-5 text-center text-xs text-slate-500">
        Copyright 2026 {BRAND.companyName}. Public branding: ZITO. Website: {publicContact.website}.
      </div>
    </footer>
  );
}

function PublicShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#eef8ff] text-slate-950">
      <PublicHeader />
      {children}
      <PublicFooter />
    </div>
  );
}

function SectionIntro({
  eyebrow,
  title,
  description,
  light = false,
  centered = false,
}: {
  eyebrow: string;
  title: string;
  description: string;
  light?: boolean;
  centered?: boolean;
}) {
  return (
    <div className={cx('max-w-3xl', centered && 'mx-auto text-center')}>
      <p className={cx('text-sm font-bold uppercase', light ? 'text-cyan-200' : 'text-blue-700')}>{eyebrow}</p>
      <h2 className={cx('mt-3 text-3xl font-black leading-tight sm:text-4xl', light ? 'text-white' : 'text-slate-950')}>{title}</h2>
      <p className={cx('mt-4 text-base leading-7', light ? 'text-slate-300' : 'text-slate-600')}>{description}</p>
    </div>
  );
}

function FeatureGrid({ items, tone = 'light' }: { items: IconCard[]; tone?: 'light' | 'dark' }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <article
            key={item.title}
            className={cx(
              'relative overflow-hidden rounded-[1rem] border p-5 transition duration-200 hover:-translate-y-1',
              tone === 'dark'
                ? 'border-white/10 bg-white/[0.055] text-white shadow-xl shadow-black/20 hover:border-cyan-300/35'
                : 'border-sky-100 bg-[#f7fcff] text-slate-950 shadow-sm hover:border-sky-200 hover:shadow-lg',
            )}
          >
            <span className={cx('absolute inset-x-0 top-0 h-0.5', tone === 'dark' ? 'bg-gradient-to-r from-cyan-300/80 to-violet-400/80' : 'bg-gradient-to-r from-blue-600 to-cyan-400')} />
            <div className="flex items-start justify-between gap-4">
              <IconBadge icon={Icon} tone={tone === 'dark' ? 'dark' : 'light'} />
              {item.meta ? (
                <span className={cx('rounded-lg px-2.5 py-1 text-xs font-bold', tone === 'dark' ? 'bg-white/10 text-cyan-100' : 'bg-[#e8f6ff] text-slate-600')}>
                  {item.meta}
                </span>
              ) : null}
            </div>
            <h3 className={cx('mt-5 text-lg font-black', tone === 'dark' ? 'text-white' : 'text-slate-950')}>{item.title}</h3>
            <p className={cx('mt-3 text-sm leading-6', tone === 'dark' ? 'text-slate-300' : 'text-slate-600')}>{item.description}</p>
          </article>
        );
      })}
    </div>
  );
}

function PhotoTile({
  image,
  label,
  className = '',
}: {
  image: string;
  label: string;
  className?: string;
}) {
  return (
    <div
      className={cx('relative overflow-hidden rounded-[1rem] border border-sky-100 bg-[#d8ecfb] shadow-xl shadow-slate-950/20', className)}
      style={{
        backgroundImage: `linear-gradient(180deg,rgba(8,20,38,0.05),rgba(8,20,38,0.46)),url(${image})`,
        backgroundPosition: 'center',
        backgroundSize: 'cover',
      }}
    >
      <span className="absolute bottom-3 left-3 rounded-lg bg-[#f2fbff]/90 px-3 py-1.5 text-xs font-black text-slate-950 shadow-sm backdrop-blur">
        {label}
      </span>
    </div>
  );
}

function AppStoreButtons({ light = false }: { light?: boolean }) {
  const items: Array<[string, string, LucideIcon]> = [
    ['Status', 'Coming soon', Smartphone],
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {items.map(([label, store, Icon]) => {
        const DisplayIcon = Icon as LucideIcon;
        return (
          <Link
            key={store}
            href="/coming-soon"
            className={cx(
              'inline-flex min-h-12 items-center gap-3 rounded-lg px-3 transition focus:outline-none focus:ring-2 focus:ring-blue-300',
              light
                ? 'border border-white/20 bg-white/10 text-white hover:bg-white/20'
                : 'border border-sky-100 bg-[#f7fcff] text-slate-950 shadow-sm hover:bg-[#eaf6ff]',
            )}
          >
            <DisplayIcon className={cx('h-5 w-5 shrink-0', light ? 'text-cyan-100' : 'text-blue-700')} aria-hidden="true" />
            <span className="flex flex-col leading-none">
              <span className={cx('text-[11px] font-bold', light ? 'text-slate-300' : 'text-slate-500')}>{label}</span>
              <span className="mt-1 text-sm font-black">{store}</span>
            </span>
          </Link>
        );
      })}
    </div>
  );
}

function MobileAppShowcase() {
  return (
    <div className="rounded-[1.75rem] border border-white/10 bg-[#152338] p-4 shadow-2xl shadow-slate-950/20">
      <div className="mb-4 flex flex-col gap-3 rounded-[1.1rem] border border-white/10 bg-white/[0.06] px-4 py-3 text-white sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase text-cyan-100">ZITO operating stack</p>
          <p className="mt-1 text-sm font-semibold text-slate-300">Apps, fleet, warehouse, GPS, and marketplace intelligence</p>
        </div>
        <span className="inline-flex w-fit items-center gap-2 rounded-lg bg-emerald-400/10 px-3 py-2 text-xs font-black text-emerald-100">
          <span className="h-2 w-2 rounded-full bg-emerald-300" />
          Live network
        </span>
      </div>
      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="grid gap-4">
          <PhotoTile image={logisticsImages.truck} label="Trucking network" className="h-48 sm:h-56" />
          <div className="grid gap-4 sm:grid-cols-2">
            <PhotoTile image={logisticsImages.warehouse} label="Warehouses" className="h-32" />
            <PhotoTile image={logisticsImages.fleet} label="Fleet operations" className="h-32" />
          </div>
        </div>

        <div className="rounded-[1.25rem] border border-white/10 bg-[#0d1628] p-4 text-white flex flex-col justify-center">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-[1.15rem] bg-[#f8fcff] p-4 text-slate-950">
              <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
                <Image src={BRAND.assets.appIcon} alt="" width={34} height={34} className="rounded-lg" />
                <div>
                  <p className="text-xs font-black">Customer App</p>
                  <p className="text-[11px] text-slate-500">Booking & tracking</p>
                </div>
              </div>
              <div className="mt-4 rounded-lg bg-blue-50 p-4">
                <p className="text-xs font-black text-blue-900">Live shipment</p>
                <p className="mt-2 text-[11px] leading-5 text-slate-600">Pickup confirmed. Cargo in transit.</p>
                <div className="mt-4 h-2 rounded-full bg-[#d8ecfb]">
                  <div className="h-2 w-2/3 rounded-full bg-blue-600" />
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-white/10 bg-white/10 p-4 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-black uppercase text-cyan-100">Fleet dashboard</p>
                  <p className="mt-2 text-2xl font-black">GPS active</p>
                </div>
                <RadioTower className="h-7 w-7 text-cyan-100" aria-hidden="true" />
              </div>
              <div className="mt-6 grid grid-cols-3 gap-2">
                {[
                  ['24', 'Trucks'],
                  ['18', 'Drivers'],
                  ['7', 'Loads'],
                ].map(([value, label]) => (
                  <div key={label} className="rounded-lg bg-[#f2fbff] p-2 text-slate-950 text-center">
                    <p className="text-lg font-black">{value}</p>
                    <p className="text-[10px] font-bold text-slate-500">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function HomeHero() {
  return (
    <section className="relative overflow-hidden bg-[#101a2b] text-white">
      <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(26,111,255,0.13),transparent_38%,rgba(168,85,247,0.10)_72%,transparent)]" />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.045)_1px,transparent_1px),linear-gradient(180deg,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:72px_72px] opacity-20" />
      <div className="absolute inset-x-0 bottom-0 h-28 bg-[linear-gradient(180deg,transparent,rgba(15,23,42,0.72))]" />
      <div className="relative mx-auto grid min-h-[78svh] max-w-7xl items-center gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[0.82fr_1.18fr] lg:px-8">
        <div className="max-w-3xl py-8">
          <div className="mb-8 inline-flex items-center gap-3 rounded-lg border border-white/10 bg-white/10 px-3 py-2 text-sm font-bold text-cyan-100 shadow-sm backdrop-blur">
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            App coming soon. Join the ecosystem.
          </div>
          <div className="mb-6 flex items-center gap-4">
            <span className="relative h-24 w-24 overflow-hidden rounded-lg border border-white/10 bg-slate-950 shadow-xl shadow-slate-950/30">
              <Image src={BRAND.assets.appIcon} alt="ZITO product logo" fill sizes="64px" className="object-cover" priority />
            </span>
            <div>
              <p className="text-5xl font-black leading-none text-white sm:text-6xl">ZITO</p>
              <p className="mt-2 text-sm font-bold text-cyan-200">{BRAND.appTagline}</p>
            </div>
          </div>
          <h1 className="max-w-4xl text-5xl font-black leading-[1.06] text-white sm:text-6xl lg:text-[4rem]">
            Powering Africa's{' '}
            <span className="bg-gradient-to-r from-cyan-200 via-blue-200 to-violet-200 bg-clip-text text-transparent">
              Smart Logistics
            </span>{' '}
            Infrastructure
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
            ZITO connects customers, fleets, warehouses, GPS systems, transport operations, and logistics intelligence through one intelligent digital ecosystem.
          </p>
          <div className="mt-6 grid max-w-2xl gap-3 sm:grid-cols-3">
            {[
              ['Contact', publicContact.mobile],
              ['Email', publicContact.email],
              ['Location', publicContact.address],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg border border-white/10 bg-white/[0.065] px-3 py-3 shadow-sm">
                <p className="text-[11px] font-black uppercase text-cyan-100">{label}</p>
                <p className="mt-1 text-xs font-semibold text-slate-200">{value}</p>
              </div>
            ))}
          </div>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/coming-soon"
              className="inline-flex min-h-12 items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-[#e9f7ff] px-6 text-sm font-black text-slate-950 shadow-xl shadow-slate-950/20 transition hover:bg-[#d9efff] focus:outline-none focus:ring-2 focus:ring-blue-300"
            >
              Coming soon
              <Smartphone className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link
              href="/partners/register"
              className="inline-flex min-h-12 items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-white/20 bg-white/10 px-6 text-sm font-black text-white shadow-sm transition hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-blue-300"
            >
              Join as Transport Partner
              <Truck className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
          {/* <Link href="/platform" className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-cyan-200 transition hover:text-white">
            Explore ecosystem
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Link> */}
          {/* <div className="mt-7">
            <AppStoreButtons light />
          </div> */}
        </div>
        <MobileAppShowcase />
      </div>
    </section>
  );
}

function MetricStrip() {
  return (
    <section className="border-y border-white/10 bg-[#0f1b2e] px-4 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-7xl gap-3 py-5 md:grid-cols-4">
        {heroMetrics.map((metric) => (
          <div key={metric.label} className="rounded-[1rem] border border-white/10 bg-white/[0.055] px-4 py-5 text-center">
            <p className="text-2xl font-black text-white">{metric.value}</p>
            <p className="mt-2 text-sm font-bold text-slate-400">{metric.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function OperationsSignalBar() {
  return (
    <section className="border-y border-blue-400/15 bg-[#101a2b] px-4 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-7xl gap-3 py-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {operationSignals.map(([label, status, detail]) => (
          <div key={label} className="rounded-lg border border-white/10 bg-white/[0.055] px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-300" />
              <p className="text-[11px] font-black uppercase text-slate-400">{label}</p>
            </div>
            <p className="mt-2 text-sm font-black text-cyan-100">{status}</p>
            <p className="mt-1 text-xs font-semibold text-slate-300">{detail}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function BookingFlowBand() {
  return (
    <section className="bg-[#121c2c] px-4 py-16 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <SectionIntro
          eyebrow="Operating workflow"
          title="From booking to delivery, every handoff has a clear owner."
          description="The website now shows ZITO as an actual logistics operating system: demand, capacity, GPS, warehouse handoffs, proof, support, and payments working together."
          light
          centered
        />
        <div className="mt-10 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          {bookingFlow.map(([step, title, owner]) => (
            <article key={step} className="relative rounded-[1rem] border border-white/10 bg-white/[0.06] p-4 shadow-xl shadow-slate-950/10">
              <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-violet-500 text-sm font-black text-white">
                {step}
              </span>
              <h3 className="mt-5 text-base font-black text-white">{title}</h3>
              <p className="mt-2 text-xs font-bold uppercase text-cyan-100">{owner}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function MarketplaceWorkflowPanel() {
  return (
    <div className="rounded-[1.5rem] border border-white/10 bg-[#101a2b] p-4 text-white shadow-2xl shadow-slate-950/20">
      <div className="rounded-[1rem] border border-white/10 bg-white/[0.055] p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase text-cyan-100">Marketplace load</p>
            <h3 className="mt-2 text-xl font-black text-white">Nairobi depot to coastal distribution hub</h3>
          </div>
          <span className="rounded-lg bg-emerald-400/10 px-3 py-2 text-xs font-black text-emerald-100">Matched</span>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {[
            ['18T', 'Truck class'],
            ['2h 40m', 'ETA'],
            ['GPS', 'Visibility'],
          ].map(([value, label]) => (
            <div key={label} className="rounded-lg bg-[#f2fbff] p-3 text-slate-950">
              <p className="text-xl font-black">{value}</p>
              <p className="mt-1 text-[11px] font-bold text-slate-500">{label}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-4 grid gap-3">
        {marketplaceFlow.map(([title, body], index) => (
          <div key={title} className="grid grid-cols-[40px_1fr] gap-3 rounded-lg border border-white/10 bg-white/[0.045] p-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 text-sm font-black text-cyan-100">
              {index + 1}
            </span>
            <div>
              <p className="text-sm font-black text-white">{title}</p>
              <p className="mt-1 text-xs leading-5 text-slate-300">{body}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TechnologyControlPanel() {
  const techSignals = [
    ['Telemetry stream', 'Vehicle pings, route events, warehouse scans, and support alerts.'],
    ['Decision layer', 'ETA context, route health, marketplace quality, and exception priority.'],
    ['Security control', 'Role access, audit records, document checks, and operating permissions.'],
    ['Integration surface', 'Payments, maps, messaging, partner APIs, and enterprise reporting.'],
  ];

  return (
    <div className="rounded-[1.5rem] border border-white/10 bg-[#101a2b] p-4 text-white shadow-2xl shadow-slate-950/20">
      <div className="flex flex-col gap-4 rounded-[1rem] border border-white/10 bg-white/[0.055] p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase text-cyan-100">Technology control layer</p>
          <h3 className="mt-2 text-2xl font-black text-white">Tracking, APIs, roles, and analytics in one stack.</h3>
        </div>
        <DatabaseZap className="h-10 w-10 text-cyan-100" aria-hidden="true" />
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {techSignals.map(([title, body]) => (
          <article key={title} className="rounded-lg border border-white/10 bg-white/[0.05] p-4">
            <p className="text-sm font-black text-white">{title}</p>
            <p className="mt-2 text-xs leading-5 text-slate-300">{body}</p>
          </article>
        ))}
      </div>
      <div className="mt-4 rounded-[1rem] border border-cyan-300/20 bg-cyan-300/10 p-4">
        <div className="grid gap-3 sm:grid-cols-4">
          {[
            ['99.9%', 'API readiness'],
            ['RBAC', 'Access model'],
            ['Live', 'GPS stream'],
            ['Audit', 'Event trail'],
          ].map(([value, label]) => (
            <div key={label} className="rounded-lg bg-[#f2fbff] p-3 text-slate-950">
              <p className="text-xl font-black">{value}</p>
              <p className="mt-1 text-[11px] font-bold text-slate-500">{label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function HomePageContent() {
  const appEcosystem = [
    {
      title: 'Customer App',
      body: 'Book shipments, track cargo live, manage payments, and coordinate courier deliveries from one clean mobile experience.',
      icon: Smartphone,
      points: ['Booking', 'Live tracking', 'Payments'],
    },
    {
      title: 'Partner App',
      body: 'Manage trucks, drivers, load opportunities, earnings, and route work for transport businesses and fleet owners.',
      icon: Truck,
      points: ['Fleet work', 'Drivers', 'Earnings'],
    },
    {
      title: 'Fleet Dashboard',
      body: 'Give logistics teams GPS visibility, analytics, route status, fuel signals, and operational control.',
      icon: BarChart3,
      points: ['GPS tracking', 'Analytics', 'Operations'],
    },
    {
      title: 'Warehouse System',
      body: 'Coordinate inventory, cargo movement, storage capacity, warehouse teams, and shipment handoffs.',
      icon: Warehouse,
      points: ['Inventory', 'Operations', 'Cargo'],
    },
  ];

  const marketplaceItems = [
    { title: 'Trucking operations', icon: Truck },
    { title: 'Driver operations', icon: UsersRound },
    { title: 'Transport marketplace', icon: Handshake },
    { title: 'Enterprise logistics', icon: Building2 },
  ];

  return (
    <>
      <HomeHero />
      <MetricStrip />
      <OperationsSignalBar />

      <section className="bg-[#eaf6ff] px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <SectionIntro
            eyebrow="App ecosystem"
            title="Four product layers, one logistics operating system."
            description="ZITO is built around the experiences people actually use: customers booking shipments, partners running fleets, and teams monitoring logistics intelligence."
            centered
          />
          <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {appEcosystem.map((item) => {
              const Icon = item.icon;
              return (
                <article key={item.title} className="relative overflow-hidden rounded-[1.25rem] border border-sky-100 bg-[#f8fcff] p-6 shadow-sm transition hover:-translate-y-1 hover:border-sky-200 hover:shadow-xl hover:shadow-blue-950/10">
                  <span className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-600 via-cyan-400 to-violet-500" />
                  <IconBadge icon={Icon} tone="light" />
                  <h3 className="mt-6 text-2xl font-black text-slate-950">{item.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-slate-600">{item.body}</p>
                  <div className="mt-6 grid gap-2">
                    {item.points.map((point) => (
                      <div key={point} className="flex items-center gap-3 rounded-lg bg-[#eaf6ff] px-3 py-2 text-sm font-bold text-slate-700">
                        <CheckCircle2 className="h-4 w-4 text-blue-600" aria-hidden="true" />
                        {point}
                      </div>
                    ))}
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <BookingFlowBand />


      <section className="bg-[#eaf6ff] px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <SectionIntro
            eyebrow="Trusted direction"
            title="A serious logistics technology company, built for scale."
            description="The brand now reads as a modern operating platform for customers, partners, warehouses, fleets, and enterprise logistics teams."
            centered
          />
          <div className="mt-10 grid gap-4 lg:grid-cols-3">
            {testimonials.map((testimonial) => (
              <article key={testimonial.name} className="rounded-[1.25rem] border border-sky-100 bg-[#f8fcff] p-6 shadow-sm">
                <p className="text-base leading-7 text-slate-700">"{testimonial.quote}"</p>
                <p className="mt-5 text-sm font-black text-slate-950">{testimonial.name}</p>
                <p className="mt-1 text-sm text-slate-500">{testimonial.role}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <ContactCta
        eyebrow="Launch with ZITO"
        title="Start with the customer app or join as a verified logistics partner."
        description="Use ZITO for shipment booking, live tracking, fleet participation, warehouse coordination, and support from one connected ecosystem."
      />
    </>
  );
}

function ContactCta({
  eyebrow = 'Start with ZITO',
  title = 'Move your first shipment or join the supply network.',
  description = 'Register as a transport partner or speak with the ZITO team about logistics operations (Customer app coming soon!).',
  primaryLabel = 'Coming soon',
  secondaryLabel = 'Partner Signup',
  secondaryHref = '/partners/register',
}: {
  eyebrow?: string;
  title?: string;
  description?: string;
  primaryLabel?: string;
  secondaryLabel?: string;
  secondaryHref?: string;
}) {
  return (
    <section className="bg-[#eaf6ff] px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-7xl items-center gap-8 overflow-hidden rounded-[1.5rem] border border-white/10 bg-[linear-gradient(135deg,#101a2b_0%,#152338_56%,#213552_100%)] p-6 text-white shadow-2xl shadow-slate-950/15 sm:p-8 lg:grid-cols-[1fr_0.82fr]">
        <div>
          <p className="text-sm font-bold uppercase text-cyan-200">{eyebrow}</p>
          <h2 className="mt-3 text-3xl font-black leading-tight sm:text-4xl">{title}</h2>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">{description}</p>
        </div>
        <div className="rounded-[1rem] border border-white/10 bg-white/[0.06] p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Link
              href="/contact"
              className="inline-flex min-h-12 items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-[#e9f7ff] px-5 text-sm font-black text-slate-950 transition hover:bg-[#d9efff] focus:outline-none focus:ring-2 focus:ring-cyan-300"
            >
              {primaryLabel}
              <Smartphone className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link
              href={secondaryHref}
              className="inline-flex min-h-12 items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-white/20 bg-white/10 px-5 text-sm font-black text-white transition hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-cyan-300"
            >
              {secondaryLabel}
              <Truck className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
          <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <a href={`tel:${publicContact.mobile.replace(/\s/g, '')}`} className="rounded-lg border border-white/10 bg-white/[0.05] px-3 py-3 text-slate-200 transition hover:bg-white/10">
              <span className="block text-[11px] font-black uppercase text-cyan-100">Contact</span>
              {publicContact.mobile}
            </a>
            <a href={`mailto:${publicContact.email}`} className="rounded-lg border border-white/10 bg-white/[0.05] px-3 py-3 text-slate-200 transition hover:bg-white/10">
              <span className="block text-[11px] font-black uppercase text-cyan-100">Email</span>
              {publicContact.email}
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

function PageHero({
  eyebrow,
  title,
  description,
  children,
  panelTitle,
  panelDescription,
  highlights,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children?: ReactNode;
  panelTitle?: string;
  panelDescription?: string;
  highlights?: Array<[string, string]>;
}) {
  const heroHighlights = highlights ?? [
    ['Focus', eyebrow],
    ['Operating layer', 'Connected logistics workflow'],
    ['Contact', publicContact.mobile],
  ];

  return (
    <section className="relative overflow-hidden bg-[#101a2b] px-4 py-16 text-white sm:px-6 lg:px-8">
      <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(26,111,255,0.14),transparent_42%,rgba(168,85,247,0.09)_74%,transparent)]" />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(180deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:80px_80px] opacity-20" />
      <div className="relative mx-auto grid max-w-7xl items-end gap-10 lg:grid-cols-[1fr_0.72fr]">
        <div>
          <p className="text-sm font-bold uppercase text-cyan-200">{eyebrow}</p>
          <h1 className="mt-4 max-w-4xl text-4xl font-black leading-tight sm:text-5xl lg:text-6xl">{title}</h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-300">{description}</p>
        </div>
        {children ?? (
          <div className="rounded-[1.25rem] border border-white/10 bg-white/[0.065] p-5 text-white shadow-2xl shadow-slate-950/20 backdrop-blur">
            <BrandLockup inverse />
            <p className="mt-5 text-sm font-black uppercase text-cyan-100">{panelTitle ?? `${eyebrow} snapshot`}</p>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              {panelDescription ?? 'A focused view of the operating layer behind this part of the ZITO ecosystem.'}
            </p>
            <div className="mt-5 grid gap-3">
              {heroHighlights.map(([label, value]) => (
                <div key={label} className="rounded-lg border border-white/10 bg-white/[0.055] px-3 py-3">
                  <p className="text-[11px] font-black uppercase text-cyan-100">{label}</p>
                  <p className="mt-1 text-sm font-semibold text-slate-200">{value}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

export function HomePage() {
  return (
    <PublicShell>
      <HomePageContent />
    </PublicShell>
  );
}

export function AboutPage() {
  const storyCards = [
    {
      title: 'Company story',
      body:
        'Zito Tech Africa Limited is shaping ZITO as a logistics technology ecosystem for customers, transporters, warehouses, fleets, drivers, and operations teams.',
    },
    {
      title: 'Founder vision',
      body:
        'The vision is to make African logistics more visible, accountable, data-driven, and scalable through connected infrastructure rather than fragmented manual coordination.',
    },
    {
      title: 'Operational philosophy',
      body:
        'Every workflow should reduce uncertainty: who owns the shipment, where it is, what changed, what is approved, and what needs attention next.',
    },
    {
      title: 'Expansion mission',
      body:
        'ZITO is designed for growth from local execution to regional marketplace coverage, with enterprise reliability and partner governance at the center.',
    },
  ];

  return (
    <PublicShell>
      <PageHero
        eyebrow="About"
        title="Zito Tech Africa Limited is building the logistics layer between demand, capacity, and control."
        description="The company behind ZITO is technology-first, operations-aware, and focused on the infrastructure gap that slows African commerce."
        panelTitle="Company operating view"
        panelDescription="A founder-led infrastructure company focused on trust, visibility, and logistics execution."
        highlights={[
          ['Company', 'Zito Tech Africa Limited'],
          ['Base', publicContact.address],
          ['Mission', 'African logistics infrastructure'],
        ]}
      />
      <section className="bg-[#eaf6ff] px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-5 md:grid-cols-2">
          {storyCards.map((card) => (
            <article key={card.title} className="rounded-lg border border-sky-100 bg-[#f8fcff] p-6 shadow-sm">
              <h2 className="text-xl font-black text-slate-950">{card.title}</h2>
              <p className="mt-4 text-sm leading-7 text-slate-600">{card.body}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="bg-[#f2f9ff] px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.8fr_1.2fr]">
          <SectionIntro
            eyebrow="Operating principles"
            title="Premium design, practical execution, measurable trust."
            description="ZITO's brand should feel futuristic, but the platform promise is grounded in real operating controls."
          />
          <FeatureGrid
            items={[
              { title: 'Visibility', description: 'Every shipment, partner, warehouse, invoice, and support issue should be traceable.', icon: RadioTower },
              { title: 'Governance', description: 'Approvals, verification, roles, and audit-ready workflows protect the network as it scales.', icon: ShieldCheck },
              { title: 'Scalability', description: 'Marketplace architecture lets demand, supply, capacity, and operations expand together.', icon: Layers3 },
            ]}
          />
        </div>
      </section>
      <ContactCta
        eyebrow="Company conversations"
        title="Talk with ZITO about partnerships, infrastructure, or expansion."
        description="Use this path for company inquiries, investor conversations, enterprise logistics discussions, and strategic partner alignment."
        primaryLabel="Contact Team"
        secondaryLabel="View Platform"
        secondaryHref="/platform"
      />
    </PublicShell>
  );
}

export function ServicesPage() {
  const solutions = [
    {
      title: 'Customer logistics',
      body: 'Mobile-first booking, live shipment visibility, secure payments, delivery support, and cargo status updates.',
      icon: Smartphone,
    },
    {
      title: 'Transport operators',
      body: 'Load acceptance, fleet coordination, driver management, earnings visibility, and route operations.',
      icon: Truck,
    },
    {
      title: 'Enterprise logistics',
      body: 'Contract movement, shipment oversight, operational reporting, warehouse coordination, and account-level workflows.',
      icon: Building2,
    },
    {
      title: 'Marketplace network',
      body: 'Connect cargo demand with verified transporter supply, warehouse capacity, GPS visibility, and service quality.',
      icon: Handshake,
    },
  ];

  return (
    <PublicShell>
      <PageHero
        eyebrow="Solutions"
        title="Purpose-built logistics solutions for every side of the ecosystem."
        description="Solutions are organized by who uses ZITO: customers, transport partners, enterprises, and marketplace operators."
        panelTitle="Solution map"
        panelDescription="A practical split between demand, supply, enterprise workflows, and marketplace coordination."
        highlights={[
          ['Demand', 'Customer logistics'],
          ['Supply', 'Transport operators'],
          ['Enterprise', 'Managed logistics'],
        ]}
      />
      <section className="bg-[#121c2c] px-4 py-16 text-white sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-4">
          {solutions.map((solution) => {
            const Icon = solution.icon;
            return (
              <article key={solution.title} className="rounded-[1.25rem] border border-white/10 bg-white/[0.06] p-6 shadow-xl shadow-slate-950/10">
                <Icon className="h-7 w-7 text-cyan-200" aria-hidden="true" />
                <h2 className="mt-6 text-xl font-black text-white">{solution.title}</h2>
                <p className="mt-4 text-sm leading-7 text-slate-300">{solution.body}</p>
              </article>
            );
          })}
        </div>
      </section>
      <section className="bg-[#eaf6ff] px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-[0.9fr_1.1fr]">
          <SectionIntro
            eyebrow="Operational clarity"
            title="Each solution maps to a real logistics job."
            description="The Solutions page is intentionally different from the homepage: it explains customer, partner, enterprise, and marketplace use cases without repeating the whole ecosystem story."
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <PhotoTile image={logisticsImages.truck} label="Transport supply" className="h-56" />
            <PhotoTile image={logisticsImages.warehouse} label="Storage and cargo" className="h-56" />
          </div>
        </div>
      </section>
      <ContactCta
        eyebrow="Find your solution"
        title="Choose the logistics workflow your business needs first."
        description="Start with customer delivery, transport operations, enterprise logistics, or marketplace capacity depending on your role."
        primaryLabel="Discuss Solution"
        secondaryLabel="Explore Fleet"
        secondaryHref="/fleet"
      />
    </PublicShell>
  );
}

export function FleetPage() {
  const fleetItems = [
    ['Live GPS tracking', 'See vehicles, routes, drivers, and cargo movement in operational context.'],
    ['Driver management', 'Coordinate driver assignments, trip status, documentation, and performance.'],
    ['Fuel and route signals', 'Track operational cost signals and route decisions with fleet visibility.'],
    ['Fleet earnings', 'Give transport partners a clearer view of jobs, settlements, and business performance.'],
  ];

  return (
    <PublicShell>
      <PageHero
        eyebrow="Fleet"
        title="Fleet management for transporters, drivers, and GPS-connected operations."
        description="A dedicated fleet layer for vehicle visibility, driver coordination, earnings, route status, and partner growth."
      >
        <PhotoTile image={logisticsImages.fleet} label="Fleet management system" className="h-72" />
      </PageHero>
      <section className="bg-[#121c2c] px-4 py-16 text-white sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.85fr_1.15fr]">
          <SectionIntro
            eyebrow="Fleet stack"
            title="The partner app is a business control surface."
            description="Fleet owners need more than load alerts. They need driver, vehicle, route, GPS, and earnings workflows that stay connected."
            light
          />
          <div className="grid gap-4 sm:grid-cols-2">
            {fleetItems.map(([title, body]) => (
              <article key={title} className="rounded-[1.25rem] border border-white/10 bg-white/[0.06] p-5">
                <Truck className="h-6 w-6 text-cyan-200" aria-hidden="true" />
                <h2 className="mt-5 text-lg font-black text-white">{title}</h2>
                <p className="mt-3 text-sm leading-6 text-slate-300">{body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
      <section className="bg-[#f2f9ff] px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-6 md:grid-cols-3">
          {[
            ['24', 'tracked vehicles'],
            ['18', 'active drivers'],
            ['7', 'loads in motion'],
          ].map(([value, label]) => (
            <div key={label} className="rounded-[1.25rem] border border-sky-100 bg-[#f8fcff] p-6 text-center shadow-sm">
              <p className="text-4xl font-black text-slate-950">{value}</p>
              <p className="mt-2 text-sm font-bold text-slate-500">{label}</p>
            </div>
          ))}
        </div>
      </section>
      <ContactCta
        eyebrow="Transport partner path"
        title="Bring vehicles, drivers, and load operations into one fleet layer."
        description="Fleet owners can use ZITO to coordinate driver activity, GPS visibility, route status, earnings, and shipment execution."
        primaryLabel="Fleet Inquiry"
        secondaryLabel="Partner Signup"
      />
    </PublicShell>
  );
}

export function WarehousingPage() {
  return (
    <PublicShell>
      <PageHero
        eyebrow="Warehousing"
        title="Warehouse operations connected to shipments, fleets, and customers."
        description="ZITO brings warehouse coordination into the logistics ecosystem: cargo visibility, inventory movement, storage capacity, and shipment handoffs."
      >
        <PhotoTile image={logisticsImages.warehouse} label="Warehouse ecosystem" className="h-72" />
      </PageHero>
      <section className="bg-[#eaf6ff] px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              ['Inventory management', 'Track cargo movement, storage states, scan flows, and stock visibility.'],
              ['Warehouse operations', 'Coordinate facility teams, receiving, dispatch, storage, and handoff workflows.'],
              ['Cargo management', 'Connect shipment status to warehouse movements and transport readiness.'],
              ['Capacity visibility', 'Expose storage capacity and warehouse availability to logistics operations.'],
            ].map(([title, body]) => (
              <article key={title} className="rounded-[1.25rem] border border-sky-100 bg-[#f8fcff] p-5">
                <Warehouse className="h-6 w-6 text-blue-700" aria-hidden="true" />
                <h2 className="mt-5 text-lg font-black text-slate-950">{title}</h2>
                <p className="mt-3 text-sm leading-6 text-slate-600">{body}</p>
              </article>
            ))}
          </div>
          <div className="rounded-[1.5rem] bg-[#121c2c] p-5 text-white shadow-xl shadow-slate-950/15">
            <p className="text-sm font-black uppercase text-cyan-200">Warehouse command</p>
            <h2 className="mt-4 text-3xl font-black">Storage and transport working together.</h2>
            <p className="mt-4 text-sm leading-7 text-slate-300">
              The warehousing page is intentionally focused on storage operations, unlike the homepage which explains the full ecosystem.
            </p>
          </div>
        </div>
      </section>
      <ContactCta
        eyebrow="Warehouse operator path"
        title="Connect storage capacity with shipment movement and transport readiness."
        description="Warehouse teams can coordinate inventory movement, receiving, dispatch, cargo visibility, and fleet handoffs through the ZITO ecosystem."
        primaryLabel="Warehouse Inquiry"
        secondaryLabel="View Solutions"
        secondaryHref="/services"
      />
    </PublicShell>
  );
}

export function TechnologyPage() {
  return (
    <PublicShell>
      <PageHero
        eyebrow="Technology"
        title="A modern operating stack for real-time logistics intelligence."
        description="ZITO's technology story centers on tracking, smart routing, RBAC, dashboards, APIs, analytics, mobile workflows, and secure integrations."
        panelTitle="System architecture view"
        panelDescription="The technical layer behind route visibility, partner governance, mobile workflows, and enterprise reporting."
        highlights={[
          ['Data layer', 'Tracking and events'],
          ['Security', 'RBAC and audit trail'],
          ['Integrations', 'Maps, payments, APIs'],
        ]}
      />
      <section className="bg-[#eaf6ff] px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <FeatureGrid items={technologyStack} />
        </div>
      </section>
      <section className="bg-[#f2f9ff] px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-[0.8fr_1.2fr]">
          <SectionIntro
            eyebrow="Real operating platform"
            title="Mobile apps, fleet visibility, and logistics dashboards working together."
            description="The technology page now presents ZITO as a real logistics product: apps, GPS, warehouse visibility, route operations, and enterprise workflow intelligence."
          />
          <TechnologyControlPanel />
        </div>
      </section>
      <ContactCta
        eyebrow="Technology inquiry"
        title="Review the tracking, API, and governance layer behind ZITO."
        description="For enterprise teams, partners, and technical stakeholders, ZITO can support secure integrations, fleet telemetry, and operating dashboards."
        primaryLabel="Talk Technology"
        secondaryLabel="View Platform"
        secondaryHref="/platform"
      />
    </PublicShell>
  );
}

export function PlatformPage() {
  const workflow = [
    ['1', 'Customer or corporate account creates demand with shipment, location, cargo, payment, and service requirements.'],
    ['2', 'Operations matches the work to fleet, driver, transporter, courier, warehouse, or marketplace capacity.'],
    ['3', 'Driver and partner apps handle execution updates, proof, exception reporting, and handoff status.'],
    ['4', 'Governance workflows keep verification, payments, alerts, support, performance, and audit records aligned.'],
  ];

  return (
    <PublicShell>
      <PageHero
        eyebrow="Platform Ecosystem"
        title="Customer, partner, driver, warehouse, and logistics operations connected in one ecosystem."
        description="ZITO is not one app. It is a connected operating system where every logistics participant gets the interface and visibility they need."
        panelTitle="Ecosystem control"
        panelDescription="A multi-participant platform where every role has a purpose-built workflow and shared operating visibility."
        highlights={[
          ['Customer', 'Demand creation'],
          ['Partner', 'Fleet execution'],
          ['Operations', 'Governance and support'],
        ]}
      />
      <section className="bg-[#f2f9ff] px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <FeatureGrid items={ecosystemApps} />
        </div>
      </section>
      <section className="bg-[#eaf6ff] px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.8fr_1.2fr]">
          <SectionIntro
            eyebrow="Workflow"
            title="From onboarding to real-time operations."
            description="The ecosystem is designed to make every handoff visible, approved, and measurable."
          />
          <div className="grid gap-4">
            {workflow.map(([step, body]) => (
              <div key={step} className="grid grid-cols-[48px_1fr] gap-4 rounded-lg border border-sky-100 bg-[#f8fcff] p-4">
                <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-slate-950 text-lg font-black text-white">{step}</span>
                <p className="self-center text-sm leading-6 text-slate-700">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      <ContactCta
        eyebrow="Platform onboarding"
        title="Map your logistics role into the ZITO ecosystem."
        description="Customers, fleet partners, drivers, warehouses, and enterprise operators can connect through one coordinated platform model."
        primaryLabel="Start Mapping"
        secondaryLabel="View Solutions"
        secondaryHref="/services"
      />
    </PublicShell>
  );
}

export function CareersPage() {
  return (
    <PublicShell>
      <PageHero
        eyebrow="Careers"
        title="Build the logistics technology culture Africa deserves."
        description="ZITO needs people who care about engineering quality, operational detail, customer trust, and the enormous opportunity inside logistics infrastructure."
        panelTitle="Team-building focus"
        panelDescription="ZITO needs product, engineering, operations, QA, compliance, and partner success talent around real logistics problems."
        highlights={[
          ['Build', 'Reliable systems'],
          ['Operate', 'Field-aware workflows'],
          ['Grow', 'Africa-scale platform'],
        ]}
      />
      <section className="bg-[#eaf6ff] px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.8fr_1.2fr]">
          <SectionIntro
            eyebrow="Culture"
            title="Technical ambition with operational humility."
            description="The best ZITO team members can think in systems, respect field realities, and turn messy workflows into reliable product surfaces."
          />
          <FeatureGrid
            items={[
              { title: 'Engineering culture', description: 'Build secure, maintainable, mobile-first systems that support real logistics pressure.', icon: Cpu },
              { title: 'Logistics innovation', description: 'Translate dispatch, fleet, warehouse, finance, and support workflows into elegant products.', icon: Workflow },
              { title: 'Africa expansion', description: 'Design for scale across cities, partners, enterprise buyers, and cross-border opportunity.', icon: Globe2 },
            ]}
          />
        </div>
      </section>
      <section className="bg-[#f2f9ff] px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <SectionIntro
            eyebrow="Opportunities"
            title="Teams we are building around."
            description="Open opportunities can evolve as the platform moves from launch, to scale, to enterprise partnerships."
          />
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {openings.map((opening) => (
              <article key={opening} className="flex items-center gap-4 rounded-lg border border-sky-100 bg-[#f8fcff] p-5 shadow-sm">
                <IconBadge icon={BriefcaseBusiness} tone="light" />
                <p className="text-base font-black text-slate-950">{opening}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
      <ContactCta
        eyebrow="Join the team"
        title="Help build logistics infrastructure with product discipline and field awareness."
        description="Careers at ZITO are for people who can turn real operational pressure into clear, reliable software and service systems."
        primaryLabel="Contact Careers"
        secondaryLabel="View Company"
        secondaryHref="/about"
      />
    </PublicShell>
  );
}

export function ContactPage() {
  return (
    <PublicShell>
      <PageHero
        eyebrow="Contact"
        title="Talk to ZITO about enterprise logistics, partnerships, support, or investment."
        description="Use the contact form for demos, business inquiries, transporter onboarding, warehouse integrations, support, or partnership conversations."
        panelTitle="Inquiry routing"
        panelDescription="Choose the right contact path for commercial, technical, support, partnership, or investor conversations."
        highlights={[
          ['Phone', publicContact.mobile],
          ['Email', publicContact.email],
          ['Office region', publicContact.address],
        ]}
      />
      <section className="bg-[#f2f9ff] px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="space-y-4">
            {[
              { label: 'Contact Number', value: publicContact.mobile, icon: Phone, href: `tel:${publicContact.mobile.replace(/\s/g, '')}` },
              { label: 'Email', value: publicContact.email, icon: Mail, href: `mailto:${publicContact.email}` },
              { label: 'Website', value: publicContact.website, icon: Globe2, href: `https://${publicContact.website}` },
              { label: 'Location', value: publicContact.address, icon: MapPin },
            ].map((item) => {
              const Icon = item.icon;
              const content = (
                <div className="flex items-center gap-4 rounded-lg border border-sky-100 bg-[#f8fcff] p-5 shadow-sm">
                  <IconBadge icon={Icon} tone="light" />
                  <div>
                    <p className="text-sm font-bold text-slate-500">{item.label}</p>
                    <p className="mt-1 text-base font-black text-slate-950">{item.value}</p>
                  </div>
                </div>
              );
              return item.href ? (
                <a key={item.label} href={item.href} className="block transition hover:-translate-y-1">
                  {content}
                </a>
              ) : (
                <div key={item.label}>{content}</div>
              );
            })}
            <div className="overflow-hidden rounded-lg border border-sky-100 bg-[#f8fcff] shadow-sm">
              <iframe
                title="ZITO office region map"
                src="https://www.google.com/maps?q=Nairobi%2C%20Kenya&output=embed"
                className="h-72 w-full border-0"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          </div>

          <form action={`mailto:${publicContact.email}`} method="post" encType="text/plain" className="rounded-lg border border-sky-100 bg-[#f8fcff] p-6 shadow-sm">
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                ['Full name', 'name', 'text'],
                ['Company', 'company', 'text'],
                ['Email', 'email', 'email'],
                ['Phone', 'phone', 'tel'],
              ].map(([label, name, type]) => (
                <label key={name} className="block">
                  <span className="text-sm font-bold text-slate-700">{label}</span>
                  <input
                    className="mt-2 min-h-12 w-full rounded-lg border border-sky-100 bg-[#f2fbff] px-3 text-sm text-slate-950 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    name={name}
                    type={type}
                    required={name === 'name' || name === 'email'}
                  />
                </label>
              ))}
            </div>
            <label className="mt-4 block">
              <span className="text-sm font-bold text-slate-700">Inquiry type</span>
              <select name="inquiryType" className="mt-2 min-h-12 w-full rounded-lg border border-sky-100 bg-[#f2fbff] px-3 text-sm text-slate-950 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100">
                <option>Request demo</option>
                <option>Business inquiry</option>
                <option>Support inquiry</option>
                <option>Partnership inquiry</option>
                <option>Investor conversation</option>
              </select>
            </label>
            <label className="mt-4 block">
              <span className="text-sm font-bold text-slate-700">Message</span>
              <textarea
                name="message"
                rows={6}
                className="mt-2 w-full rounded-lg border border-sky-100 bg-[#f2fbff] px-3 py-3 text-sm text-slate-950 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                required
              />
            </label>
            <button
              type="submit"
              className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-slate-950 px-5 text-sm font-black text-white transition hover:bg-blue-950 focus:outline-none focus:ring-2 focus:ring-blue-300 sm:w-auto"
            >
              Send inquiry
              <Send className="h-4 w-4" aria-hidden="true" />
            </button>
          </form>
        </div>
      </section>
    </PublicShell>
  );
}

export function LegalPage({ kind }: LegalPageProps) {
  const page = legalSections[kind];
  const iconMap = {
    privacy: ShieldCheck,
    terms: Scale,
    compliance: FileLock2,
  };
  const HeroIcon = iconMap[kind];

  return (
    <PublicShell>
      <PageHero eyebrow={page.eyebrow} title={page.title} description={page.description}>
        <div className="rounded-lg border border-white/20 bg-white/[0.08] p-5 backdrop-blur">
          <IconBadge icon={HeroIcon} />
          <p className="mt-5 text-sm font-bold text-cyan-100">Last updated: June 9, 2026</p>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            Contact {publicContact.email} for privacy, terms, data protection, or NDA-related requests.
          </p>
        </div>
      </PageHero>
      <section className="bg-[#f2f9ff] px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-5xl gap-4">
          {page.sections.map((section, index) => (
            <article key={section.title} className="rounded-lg border border-sky-100 bg-[#f8fcff] p-6 shadow-sm">
              <div className="flex items-start gap-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-950 text-sm font-black text-white">{index + 1}</span>
                <div>
                  <h2 className="text-xl font-black text-slate-950">{section.title}</h2>
                  <p className="mt-3 text-sm leading-7 text-slate-600">{section.body}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
      <ContactCta
        eyebrow="Governance support"
        title="Need policy, privacy, compliance, or NDA clarification?"
        description="Contact ZITO for data protection questions, legal terms, compliance review, vendor due diligence, or document access requests."
        primaryLabel="Email Governance"
        secondaryLabel="Contact Page"
        secondaryHref="/contact"
      />
    </PublicShell>
  );
}
