import type { ReactNode } from 'react';

type AlertProps = {
  children: ReactNode;
  title?: string;
  variant?: 'info' | 'success' | 'warning' | 'danger';
};

export function Alert({ children, title, variant = 'info' }: AlertProps) {
  const styles = {
    info: 'border-sky-500/30 bg-sky-500/10 text-sky-50',
    success: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-50',
    warning: 'border-amber-500/30 bg-amber-500/10 text-amber-50',
    danger: 'border-rose-500/30 bg-rose-500/10 text-rose-50',
  };

  return (
    <div className={`rounded-2xl border px-4 py-3 ${styles[variant]}`}>
      {title ? <p className="mb-1 font-semibold">{title}</p> : null}
      <div className="text-sm">{children}</div>
    </div>
  );
}
