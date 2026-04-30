import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { BRAND } from '@/lib/brand';
import { BrandLockup } from './BrandLockup';

type AuthShellProps = {
  eyebrow: string;
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
};

const productHighlights = [
  'Real-time booking, tracking, and dispatch coordination across the same platform.',
  'Warehouse, invoicing, and finance flows aligned to the PRD go-live journey.',
  'A secure multi-role workspace for customers, staff, drivers, and transport partners.',
];

export function AuthShell({
  eyebrow,
  title,
  subtitle,
  children,
  footer,
}: AuthShellProps) {
  return (
    <main className="min-h-screen px-4 py-8 sm:px-6">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl gap-6 lg:grid-cols-[1.1fr,0.9fr]">
        <section className="relative overflow-hidden rounded-[2rem] border border-slate-700/40 bg-slate-950/55 p-8 shadow-2xl backdrop-blur sm:p-10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.18),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(168,85,247,0.18),transparent_35%)]" />
          <div className="relative">
            <BrandLockup />

            <div className="mt-8 grid gap-4 xl:grid-cols-[0.92fr,1.08fr]">
              <div className="overflow-hidden rounded-[1.75rem] border border-slate-700/30 bg-white/95 p-4 shadow-2xl">
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-600">
                  Operating company
                </p>
                <div className="relative mt-3 aspect-[16/10] w-full">
                  <Image
                    src={BRAND.assets.companyLogo}
                    alt={`${BRAND.companyName} logo`}
                    fill
                    className="object-contain object-center"
                    priority
                  />
                </div>
              </div>
              <div className="overflow-hidden rounded-[1.75rem] border border-cyan-400/15 bg-slate-950/80 p-4 shadow-2xl">
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-cyan-300/80">
                  Customer-facing app
                </p>
                <div className="relative mt-3 aspect-[16/10] w-full">
                  <Image
                    src={BRAND.assets.appLogo}
                    alt={`${BRAND.appName} logo`}
                    fill
                    className="object-contain object-center"
                    priority
                  />
                </div>
              </div>
            </div>

            <p className="mt-8 text-xs font-semibold uppercase tracking-[0.3em] text-cyan-300/80">
              {eyebrow}
            </p>
            <h1 className="mt-4 max-w-xl text-4xl font-semibold tracking-tight text-white sm:text-5xl">
              {BRAND.appTagline}
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
              {BRAND.appName} is the customer-facing logistics platform.{' '}
              {BRAND.companyName} is the operating company behind the service,
              billing, and delivery controls.
            </p>

            <div className="mt-10 space-y-4">
              {productHighlights.map((item) => (
                <div
                  key={item}
                  className="rounded-2xl border border-slate-700/40 bg-slate-900/55 px-4 py-4 text-sm text-slate-200"
                >
                  {item}
                </div>
              ))}
            </div>

            <div className="mt-10 flex flex-wrap gap-3 text-sm text-slate-300">
              <Link
                href="/select-role"
                className="rounded-full border border-slate-600/60 px-4 py-2 transition hover:border-cyan-400/60 hover:bg-slate-900/60"
              >
                Choose role
              </Link>
              <Link
                href="/login"
                className="rounded-full border border-cyan-400/30 bg-cyan-500/10 px-4 py-2 text-cyan-100 transition hover:bg-violet-500/20"
              >
                Existing user login
              </Link>
            </div>
          </div>
        </section>

        <section className="rounded-[2rem] border border-slate-700/40 bg-slate-950/60 p-6 shadow-2xl backdrop-blur sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-300/80">
            {eyebrow}
          </p>
          <h2 className="mt-3 text-3xl font-semibold text-white">{title}</h2>
          <p className="mt-3 text-sm leading-6 text-slate-300">{subtitle}</p>
          <p className="mt-2 text-xs uppercase tracking-[0.22em] text-slate-500">
            {BRAND.productLine}
          </p>

          <div className="mt-8">{children}</div>

          {footer ? <div className="mt-6 text-sm text-slate-400">{footer}</div> : null}
        </section>
      </div>
    </main>
  );
}
