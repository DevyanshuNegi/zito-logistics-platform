'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Boxes,
  Check,
  ChevronDown,
  Clock3,
  DatabaseZap,
  FileCheck2,
  Globe2,
  LockKeyhole,
  Network,
  Route,
  ShieldCheck,
  Sparkles,
  Truck,
  WalletCards,
} from 'lucide-react';

type RevealProps = {
  children: React.ReactNode;
  className?: string;
};

const features = [
  {
    title: 'Live logistics cockpit',
    description: 'Track bookings, drivers, warehouse movement, alerts, and finance signals in one operational surface.',
    icon: BarChart3,
  },
  {
    title: 'Smart route operations',
    description: 'Plan pickups, monitor ETAs, flag delays, and keep customers aligned without switching tools.',
    icon: Route,
  },
  {
    title: 'KYC-ready network',
    description: 'Verify drivers, partners, documents, fleets, and warehouses with structured approval workflows.',
    icon: ShieldCheck,
  },
  {
    title: 'Fleet and warehouse control',
    description: 'Coordinate vehicles, drivers, bins, inventory, and capacity with role-aware workspaces.',
    icon: Boxes,
  },
  {
    title: 'Finance automation',
    description: 'Connect invoices, payments, reconciliation, wallets, escrow, and audit trails from day one.',
    icon: WalletCards,
  },
  {
    title: 'Enterprise-grade platform',
    description: 'Built for RBAC, audit logs, secure uploads, rate limits, and production deployment standards.',
    icon: LockKeyhole,
  },
];

const plans = [
  {
    name: 'Launch',
    price: 'KES 29k',
    description: 'For small teams digitizing bookings and customer visibility.',
    features: ['Customer booking portal', 'Basic tracking', 'Email support', 'Standard reports'],
  },
  {
    name: 'Scale',
    price: 'KES 89k',
    description: 'For growing logistics teams running fleet, dispatch, and finance together.',
    features: ['Live operations dashboard', 'Driver and fleet workflows', 'KYC and document review', 'Priority support'],
    highlighted: true,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    description: 'For multi-branch networks, courier companies, and enterprise shippers.',
    features: ['Advanced RBAC', 'Custom integrations', 'Security hardening', 'Dedicated rollout support'],
  },
];

const faqs = [
  {
    question: 'Can ZITO support multiple logistics roles?',
    answer: 'Yes. The platform supports customers, corporate accounts, drivers, transporters, courier companies, warehouses, agents, and internal admin teams.',
  },
  {
    question: 'Is the platform mobile-first?',
    answer: 'Yes. Booking, tracking, verification, and operational flows are designed for responsive web and installable PWA-style usage.',
  },
  {
    question: 'Does pricing include payments and invoices?',
    answer: 'Payment and invoice modules are part of the operating platform. Production payment setup still requires provider credentials and deployment approval.',
  },
  {
    question: 'Can we start with test OTP and switch to Twilio later?',
    answer: 'Yes. ZITO supports provider-based OTP architecture so teams can test safely and move to production providers when ready.',
  },
];

const heroSignals: Array<{ place: string; status: string; icon: LucideIcon }> = [
  { place: 'Nairobi CBD', status: 'Pickup verified', icon: ShieldCheck },
  { place: 'Industrial Area', status: 'Driver assigned', icon: Truck },
  { place: 'JKIA Cargo', status: 'Invoice ready', icon: FileCheck2 },
];

function Reveal({ children, className = '' }: RevealProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.18 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={[
        'transition duration-200 ease-out',
        visible ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0',
        className,
      ].join(' ')}
    >
      {children}
    </div>
  );
}

function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-xl border border-white/10 bg-slate-900/70">
      <button
        type="button"
        className="flex min-h-14 w-full items-center justify-between gap-4 px-5 py-4 text-left text-sm font-semibold text-white transition duration-200 ease-out hover:bg-white/[0.04] focus:outline-none focus:ring-2 focus:ring-violet-400"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        {question}
        <ChevronDown
          className={['h-5 w-5 shrink-0 text-violet-200 transition duration-200 ease-out', open ? 'rotate-180' : ''].join(' ')}
          aria-hidden="true"
        />
      </button>
      <div className={['grid transition-all duration-200 ease-out', open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'].join(' ')}>
        <div className="overflow-hidden">
          <p className="px-5 pb-5 text-sm leading-6 text-slate-300">{answer}</p>
        </div>
      </div>
    </div>
  );
}

export function SaasLandingPage() {
  return (
    <main className="min-h-screen overflow-hidden bg-slate-950 text-slate-100">
      <section className="relative min-h-[92vh] px-4 py-8 sm:px-6 lg:px-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_15%,rgba(139,92,246,0.22),transparent_32%),radial-gradient(circle_at_85%_8%,rgba(34,211,238,0.14),transparent_28%)]" />
        <div className="relative mx-auto flex max-w-7xl flex-col">
          <nav className="flex items-center justify-between" aria-label="Landing navigation">
            <Link href="/login" className="flex min-h-11 items-center gap-3 rounded-full focus:outline-none focus:ring-2 focus:ring-violet-400">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500 text-sm font-bold text-white shadow-lg shadow-violet-950/40">
                Z
              </span>
              <span className="text-sm font-semibold tracking-wide text-white">ZITO</span>
            </Link>
            <div className="hidden items-center gap-6 text-sm text-slate-300 md:flex">
              <a href="#features" className="transition hover:text-white">Features</a>
              <a href="#pricing" className="transition hover:text-white">Pricing</a>
              <a href="#faq" className="transition hover:text-white">FAQ</a>
            </div>
            <Link
              href="/login"
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] px-4 text-sm font-semibold text-white transition duration-200 ease-out hover:bg-white/[0.1] focus:outline-none focus:ring-2 focus:ring-violet-400"
            >
              Sign in
            </Link>
          </nav>

          <div className="grid flex-1 items-center gap-12 py-20 lg:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)] lg:py-28">
            <Reveal>
              <div className="inline-flex items-center gap-2 rounded-full border border-violet-300/20 bg-violet-400/10 px-3 py-1 text-xs font-semibold text-violet-100">
                <Sparkles className="h-4 w-4" />
                Modern logistics SaaS for Africa
              </div>
              <h1 className="mt-7 max-w-4xl text-5xl font-semibold tracking-tight text-white sm:text-6xl lg:text-7xl">
                Run bookings, fleets, warehouses, and finance from one command layer.
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
                ZITO brings premium mobility UX to serious logistics operations: live tracking, verified partners, secure payments, and operational analytics without the back-office drag.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/register"
                  className="inline-flex min-h-12 items-center justify-center rounded-full bg-violet-500 px-6 text-sm font-semibold text-white shadow-xl shadow-violet-950/40 transition duration-200 ease-out hover:bg-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-300"
                >
                  Start building
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
                <Link
                  href="/pwa"
                  className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] px-6 text-sm font-semibold text-white transition duration-200 ease-out hover:bg-white/[0.1] focus:outline-none focus:ring-2 focus:ring-violet-300"
                >
                  View PWA demo
                </Link>
              </div>
            </Reveal>

            <Reveal className="lg:translate-y-10">
              <div className="relative">
                <div className="absolute -inset-6 rounded-[2.5rem] bg-violet-500/20 blur-3xl" />
                <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-slate-900/90 p-4 shadow-2xl shadow-black/40">
                  <div className="rounded-[1.5rem] bg-gradient-to-br from-slate-800 via-slate-950 to-violet-950 p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-200">Live network</p>
                        <p className="mt-2 text-2xl font-semibold text-white">98.4% on-time</p>
                      </div>
                      <Truck className="h-8 w-8 text-cyan-200" />
                    </div>
                    <div className="mt-8 space-y-3">
                      {heroSignals.map(({ place, status, icon: IconComponent }) => {
                        return (
                          <div key={place} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.06] p-3">
                            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-500/15 text-violet-100">
                              <IconComponent className="h-5 w-5" />
                            </span>
                            <div>
                              <p className="text-sm font-semibold text-white">{place}</p>
                              <p className="mt-1 text-xs text-slate-400">{status}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      <section id="features" className="px-4 py-16 sm:px-6 md:py-24 lg:px-8">
        <Reveal className="mx-auto max-w-7xl">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-violet-200">Platform</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">Everything a logistics team needs, without the clutter.</h2>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <article key={feature.title} className="rounded-xl border border-white/10 bg-slate-900/70 p-6 shadow-md shadow-black/20 transition duration-200 ease-out hover:-translate-y-1 hover:border-violet-300/40">
                  <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-500/15 text-violet-100">
                    <Icon className="h-6 w-6" />
                  </span>
                  <h3 className="mt-5 text-lg font-semibold text-white">{feature.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-slate-300">{feature.description}</p>
                </article>
              );
            })}
          </div>
        </Reveal>
      </section>

      <section id="pricing" className="px-4 py-16 sm:px-6 md:py-24 lg:px-8">
        <Reveal className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-violet-200">Pricing</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">Plans that scale with your logistics network.</h2>
          </div>
          <div className="mt-10 grid gap-5 lg:grid-cols-3">
            {plans.map((plan) => (
              <article
                key={plan.name}
                className={[
                  'rounded-xl border p-6 shadow-md shadow-black/20',
                  plan.highlighted
                    ? 'border-violet-300/50 bg-violet-500/15 ring-1 ring-violet-300/30'
                    : 'border-white/10 bg-slate-900/70',
                ].join(' ')}
              >
                {plan.highlighted ? (
                  <span className="inline-flex items-center gap-2 rounded-full bg-violet-500 px-3 py-1 text-xs font-semibold text-white">
                    <BadgeCheck className="h-4 w-4" />
                    Recommended
                  </span>
                ) : null}
                <h3 className="mt-5 text-xl font-semibold text-white">{plan.name}</h3>
                <p className="mt-4 text-4xl font-semibold tracking-tight text-white">{plan.price}</p>
                <p className="mt-3 text-sm leading-6 text-slate-300">{plan.description}</p>
                <ul className="mt-6 space-y-3">
                  {plan.features.map((item) => (
                    <li key={item} className="flex gap-3 text-sm text-slate-200">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                      {item}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </Reveal>
      </section>

      <section id="faq" className="px-4 py-16 sm:px-6 md:py-24 lg:px-8">
        <Reveal className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.85fr_1.15fr]">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-violet-200">FAQ</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">Questions before launch?</h2>
            <p className="mt-4 text-sm leading-6 text-slate-300">Clear answers for teams evaluating ZITO for production logistics workflows.</p>
          </div>
          <div className="space-y-3">
            {faqs.map((faq) => (
              <FaqItem key={faq.question} question={faq.question} answer={faq.answer} />
            ))}
          </div>
        </Reveal>
      </section>

      <footer className="border-t border-white/10 px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-8 md:grid-cols-[1fr_auto_auto_auto]">
          <div>
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500 text-sm font-bold text-white">Z</span>
              <span className="text-sm font-semibold text-white">ZITO Logistics</span>
            </div>
            <p className="mt-4 max-w-sm text-sm leading-6 text-slate-400">Premium logistics infrastructure for modern African operators.</p>
          </div>
          {[
            ['Product', ['Bookings', 'Tracking', 'Fleet', 'Warehouse']],
            ['Company', ['About', 'Security', 'Careers', 'Partners']],
            ['Support', ['Help Center', 'Status', 'Contact', 'Legal']],
          ].map(([title, links]) => (
            <div key={title as string}>
              <p className="text-sm font-semibold text-white">{title}</p>
              <div className="mt-4 space-y-3">
                {(links as string[]).map((link) => (
                  <a key={link} href="#" className="block text-sm text-slate-400 transition hover:text-white">
                    {link}
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>
      </footer>
    </main>
  );
}
