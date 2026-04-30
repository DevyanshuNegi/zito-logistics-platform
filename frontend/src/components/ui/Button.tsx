'use client';

import type { ButtonHTMLAttributes, ReactNode } from 'react';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
};

export function Button({
  children,
  className = '',
  variant = 'primary',
  ...props
}: ButtonProps) {
  const styles = {
    primary:
      'bg-gradient-to-r from-cyan-500 via-blue-500 to-violet-500 text-white shadow-lg shadow-cyan-500/20 hover:from-cyan-400 hover:via-blue-400 hover:to-fuchsia-500',
    secondary: 'bg-slate-800 text-slate-100 hover:bg-slate-700',
    ghost: 'bg-transparent text-slate-200 hover:bg-slate-800/70',
    danger: 'bg-rose-500 text-white hover:bg-rose-400',
  };

  return (
    <button
      className={[
        'inline-flex items-center justify-center rounded-2xl px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50',
        styles[variant],
        className,
      ].join(' ')}
      {...props}
    >
      {children}
    </button>
  );
}
