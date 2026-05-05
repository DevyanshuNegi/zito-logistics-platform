type StatCardProps = {
  label: string;
  value: string;
  helper?: string;
  tone?: 'neutral' | 'info' | 'success' | 'warning' | 'danger';
  surfaceTone?: 'dark' | 'light';
};

export function StatCard({
  label,
  value,
  helper,
  tone = 'neutral',
  surfaceTone = 'dark',
}: StatCardProps) {
  const toneClasses =
    surfaceTone === 'light'
      ? {
          neutral: 'border-[#d7e0ec] bg-white',
          info: 'border-sky-200 bg-sky-50',
          success: 'border-emerald-200 bg-emerald-50',
          warning: 'border-amber-200 bg-amber-50',
          danger: 'border-rose-200 bg-rose-50',
        }
      : {
          neutral: 'border-slate-700/40 bg-slate-950/55',
          info: 'border-sky-500/30 bg-sky-500/10',
          success: 'border-emerald-500/30 bg-emerald-500/10',
          warning: 'border-amber-500/30 bg-amber-500/10',
          danger: 'border-rose-500/30 bg-rose-500/10',
        };

  return (
    <div
      className={[
        'rounded-3xl border p-5',
        surfaceTone === 'light'
          ? 'shadow-[0_8px_24px_rgba(15,23,42,0.05)]'
          : 'shadow-2xl backdrop-blur',
        toneClasses[tone],
      ].join(' ')}
    >
      <p
        className={
          surfaceTone === 'light'
            ? 'text-[10px] font-semibold uppercase tracking-[0.18em] text-[#64748b]'
            : 'text-xs uppercase tracking-[0.24em] text-slate-400'
        }
      >
        {label}
      </p>
      <p
        className={
          surfaceTone === 'light'
            ? 'mt-3 text-3xl font-semibold text-[#1a1a2e]'
            : 'mt-3 text-3xl font-semibold text-white'
        }
      >
        {value}
      </p>
      {helper ? (
        <p
          className={
            surfaceTone === 'light'
              ? 'mt-2 text-sm text-[#64748b]'
              : 'mt-2 text-sm text-slate-300'
          }
        >
          {helper}
        </p>
      ) : null}
    </div>
  );
}
