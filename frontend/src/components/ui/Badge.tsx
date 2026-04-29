import type { ReactNode } from 'react';

type BadgeProps = {
  children: ReactNode;
  variant?: 'brand' | 'info' | 'success' | 'danger' | 'neutral';
};

export function Badge({ children, variant = 'neutral' }: BadgeProps) {
  const styles = {
    brand: 'border-amber-400/40 bg-amber-500/15 text-amber-100',
    info: 'border-sky-400/40 bg-sky-500/15 text-sky-100',
    success: 'border-emerald-400/40 bg-emerald-500/15 text-emerald-100',
    danger: 'border-rose-400/40 bg-rose-500/15 text-rose-100',
    neutral: 'border-slate-700/70 bg-slate-900/60 text-slate-200',
  };

  return (
    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${styles[variant]}`}>
      {children}
    </span>
  );
}
