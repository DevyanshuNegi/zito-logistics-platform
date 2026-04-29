type StatCardProps = {
  label: string;
  value: string;
  helper?: string;
  tone?: 'neutral' | 'info' | 'success' | 'warning';
};

export function StatCard({
  label,
  value,
  helper,
  tone = 'neutral',
}: StatCardProps) {
  const toneClasses = {
    neutral: 'border-slate-700/40 bg-slate-950/55',
    info: 'border-sky-500/30 bg-sky-500/10',
    success: 'border-emerald-500/30 bg-emerald-500/10',
    warning: 'border-amber-500/30 bg-amber-500/10',
  };

  return (
    <div className={`rounded-3xl border p-5 shadow-2xl backdrop-blur ${toneClasses[tone]}`}>
      <p className="text-xs uppercase tracking-[0.24em] text-slate-400">{label}</p>
      <p className="mt-3 text-3xl font-semibold text-white">{value}</p>
      {helper ? <p className="mt-2 text-sm text-slate-300">{helper}</p> : null}
    </div>
  );
}
