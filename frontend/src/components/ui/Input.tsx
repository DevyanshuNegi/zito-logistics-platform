import type { InputHTMLAttributes, TextareaHTMLAttributes } from 'react';

type SharedProps = {
  label?: string;
  help?: string;
  error?: string;
  textarea?: boolean;
};

type InputProps = SharedProps &
  InputHTMLAttributes<HTMLInputElement> &
  TextareaHTMLAttributes<HTMLTextAreaElement>;

export function Input({ label, help, error, className = '', textarea, ...props }: InputProps) {
  const fieldClassName = [
    'w-full rounded-2xl border border-slate-700/70 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-400/80 focus:outline-none focus:ring-1 focus:ring-violet-500/40',
    className,
  ].join(' ');

  return (
    <label className="block space-y-2">
      {label ? <span className="text-sm font-medium text-slate-200">{label}</span> : null}
      {textarea ? (
        <textarea className={fieldClassName} {...props} />
      ) : (
        <input className={fieldClassName} {...props} />
      )}
      {error ? <span className="text-xs text-rose-300">{error}</span> : null}
      {!error && help ? <span className="text-xs text-slate-400">{help}</span> : null}
    </label>
  );
}
