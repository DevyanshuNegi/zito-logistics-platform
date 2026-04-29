import type { ReactNode } from 'react';

type SurfaceCardProps = {
  title?: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
  children: ReactNode;
};

export function SurfaceCard({
  title,
  description,
  actions,
  className = '',
  children,
}: SurfaceCardProps) {
  return (
    <section
      className={[
        'rounded-3xl border border-slate-700/40 bg-slate-950/55 p-5 shadow-2xl backdrop-blur',
        className,
      ].join(' ')}
    >
      {title || description || actions ? (
        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            {title ? <h3 className="text-lg font-semibold text-white">{title}</h3> : null}
            {description ? <p className="mt-1 text-sm text-slate-400">{description}</p> : null}
          </div>
          {actions ? <div className="shrink-0">{actions}</div> : null}
        </div>
      ) : null}

      {children}
    </section>
  );
}
