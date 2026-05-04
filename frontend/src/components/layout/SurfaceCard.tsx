import type { ReactNode } from 'react';

type SurfaceCardProps = {
  title?: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
  tone?: 'dark' | 'light';
  children: ReactNode;
};

export function SurfaceCard({
  title,
  description,
  actions,
  className = '',
  tone = 'dark',
  children,
}: SurfaceCardProps) {
  const toneClasses =
    tone === 'light'
      ? {
          frame:
            'rounded-[22px] border border-[#d7e0ec] bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.05)]',
          title: 'text-lg font-semibold text-[#1a1a2e]',
          description: 'mt-1 text-sm text-[#64748b]',
        }
      : {
          frame:
            'rounded-3xl border border-slate-700/40 bg-slate-950/55 p-5 shadow-2xl backdrop-blur',
          title: 'text-lg font-semibold text-white',
          description: 'mt-1 text-sm text-slate-400',
        };

  return (
    <section
      className={[
        toneClasses.frame,
        className,
      ].join(' ')}
    >
      {title || description || actions ? (
        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            {title ? <h3 className={toneClasses.title}>{title}</h3> : null}
            {description ? <p className={toneClasses.description}>{description}</p> : null}
          </div>
          {actions ? <div className="shrink-0">{actions}</div> : null}
        </div>
      ) : null}

      {children}
    </section>
  );
}
