import type { InputHTMLAttributes, TextareaHTMLAttributes } from 'react';

type SharedProps = {
  label?: string;
  help?: string;
  error?: string;
  textarea?: boolean;
  tone?: 'dark' | 'light';
};

type InputProps = SharedProps &
  InputHTMLAttributes<HTMLInputElement> &
  TextareaHTMLAttributes<HTMLTextAreaElement>;

export function Input({
  label,
  help,
  error,
  className = '',
  textarea,
  tone = 'dark',
  ...props
}: InputProps) {
  const toneClassName =
    tone === 'light'
      ? 'border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-100'
      : 'border-slate-700/70 bg-slate-950/60 text-slate-100 placeholder:text-slate-500 focus:border-cyan-400/80 focus:ring-1 focus:ring-violet-500/40';
  const fieldClassName = [
    'w-full rounded-2xl border px-4 py-3 text-sm focus:outline-none',
    toneClassName,
    className,
  ].join(' ');

  return (
    <label className="block space-y-2">
      {label ? (
        <span className={tone === 'light' ? 'text-sm font-medium text-slate-700' : 'text-sm font-medium text-slate-200'}>
          {label}
        </span>
      ) : null}
      {textarea ? (
        <textarea className={fieldClassName} {...props} />
      ) : (
        <input className={fieldClassName} {...props} />
      )}
      {error ? <span className="text-xs text-rose-300">{error}</span> : null}
      {!error && help ? (
        <span className={tone === 'light' ? 'text-xs text-slate-500' : 'text-xs text-slate-400'}>
          {help}
        </span>
      ) : null}
    </label>
  );
}
