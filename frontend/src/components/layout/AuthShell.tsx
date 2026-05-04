import type { ReactNode } from 'react';
import { BrandLockup } from './BrandLockup';

type AuthShellProps = {
  eyebrow: string;
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
  panelEyebrow?: string;
  panelTitle?: string;
  panelSubtitle?: string;
};

export function AuthShell({
  eyebrow,
  title,
  subtitle,
  children,
  footer,
  panelEyebrow = 'Secure Access',
  panelTitle = 'Sign in to your Zito workspace.',
  panelSubtitle = 'Use your email address or phone number, verify with a one-time code, and continue directly into operations.',
}: AuthShellProps) {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.14),transparent_24%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.16),transparent_26%),linear-gradient(180deg,#06101f_0%,#081223_100%)] px-4 py-8 sm:px-6">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl gap-6 lg:grid-cols-[1.1fr,0.9fr]">
        <section className="relative hidden overflow-hidden rounded-[2rem] border border-slate-700/40 bg-slate-950/55 p-8 shadow-2xl backdrop-blur lg:block lg:p-10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.16),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(99,102,241,0.18),transparent_34%)]" />
          <div className="relative flex h-full flex-col justify-center">
            <div>
              <BrandLockup showDescriptor={false} />
              <p className="mt-12 text-xs font-semibold uppercase tracking-[0.3em] text-cyan-300/80">
                {panelEyebrow}
              </p>
              <h1 className="mt-4 max-w-xl text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                {panelTitle}
              </h1>
              <p className="mt-5 max-w-xl text-base leading-7 text-slate-300 sm:text-lg">
                {panelSubtitle}
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-[2rem] border border-slate-700/40 bg-slate-950/65 p-6 shadow-2xl backdrop-blur sm:p-8">
          <div className="lg:hidden">
            <BrandLockup compact showDescriptor={false} />
          </div>
          <p className="mt-6 text-xs font-semibold uppercase tracking-[0.28em] text-cyan-300/80 lg:mt-0">
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
