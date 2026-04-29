import Link from 'next/link';
import type { ReactNode } from 'react';

type AuthShellProps = {
  eyebrow: string;
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
};

const phaseOneHighlights = [
  'Unified login with OTP verification and account approval checks.',
  'Multi-stop bookings with pricing, escrow, and live tracking.',
  'Driver shifts, payout visibility, and job status updates.',
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
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.16),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(245,158,11,0.18),transparent_35%)]" />
          <div className="relative">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-sky-300/80">
              {eyebrow}
            </p>
            <h1 className="mt-4 max-w-xl text-4xl font-semibold tracking-tight text-white sm:text-5xl">
              ZITO Phase 1 portal, rebuilt on the PRD v10 flow.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
              Customers, drivers, transporters, and staff can move through the
              core go-live journey without depending on the old placeholder
              routes.
            </p>

            <div className="mt-10 space-y-4">
              {phaseOneHighlights.map((item) => (
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
                className="rounded-full border border-slate-600/60 px-4 py-2 transition hover:border-slate-400 hover:bg-slate-900/60"
              >
                Choose role
              </Link>
              <Link
                href="/login"
                className="rounded-full border border-amber-400/40 bg-amber-500/15 px-4 py-2 text-amber-100 transition hover:bg-amber-500/25"
              >
                Existing user login
              </Link>
            </div>
          </div>
        </section>

        <section className="rounded-[2rem] border border-slate-700/40 bg-slate-950/60 p-6 shadow-2xl backdrop-blur sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-300/80">
            {eyebrow}
          </p>
          <h2 className="mt-3 text-3xl font-semibold text-white">{title}</h2>
          <p className="mt-3 text-sm leading-6 text-slate-300">{subtitle}</p>

          <div className="mt-8">{children}</div>

          {footer ? <div className="mt-6 text-sm text-slate-400">{footer}</div> : null}
        </section>
      </div>
    </main>
  );
}
