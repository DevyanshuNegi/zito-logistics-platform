import Link from 'next/link';
import { SurfaceCard } from '@/components/layout/SurfaceCard';
import { StatCard } from '@/components/layout/StatCard';
import type { AppGuide } from '@/lib/user-guides';

type AppGuidePageProps = {
  guide: AppGuide;
  backHref?: string;
  backLabel?: string;
};

export function AppGuidePage({
  guide,
  backHref,
  backLabel = 'Back',
}: AppGuidePageProps) {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.14),_transparent_24%),radial-gradient(circle_at_bottom_right,_rgba(59,130,246,0.16),_transparent_26%),linear-gradient(180deg,_#06101f_0%,_#081223_100%)] px-4 py-8 text-slate-100 sm:px-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <SurfaceCard
          title={guide.title}
          description={guide.subtitle}
          actions={
            backHref ? (
              <Link
                href={backHref}
                className="inline-flex items-center rounded-2xl border border-slate-700/70 bg-slate-900/60 px-4 py-2 text-sm font-medium text-slate-100 transition hover:border-slate-500/80 hover:bg-slate-900/90"
              >
                {backLabel}
              </Link>
            ) : null
          }
        >
          <div className="grid gap-4 md:grid-cols-3">
            {guide.stats.map((stat) => (
              <StatCard
                key={stat.label}
                label={stat.label}
                value={stat.value}
                helper={stat.helper}
                tone={stat.tone}
              />
            ))}
          </div>
        </SurfaceCard>

        <SurfaceCard
          title={guide.audienceLabel}
          description="Role-by-role summary of who uses this app surface and what they should do here."
        >
          <div className="grid gap-4 lg:grid-cols-2">
            {guide.roles.map((role) => (
              <div
                key={role.title}
                className="rounded-3xl border border-slate-700/40 bg-slate-950/45 p-5"
              >
                <h3 className="text-lg font-semibold text-white">{role.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-300">{role.summary}</p>
                <ul className="mt-4 space-y-2 text-sm text-slate-300">
                  {role.highlights.map((item) => (
                    <li key={item} className="rounded-2xl border border-slate-800/70 bg-slate-900/45 px-4 py-3">
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </SurfaceCard>

        <div className="grid gap-6 lg:grid-cols-3">
          {guide.sections.map((section) => (
            <SurfaceCard
              key={section.title}
              title={section.title}
              description={section.description}
              className="h-full"
            >
              <ul className="space-y-3 text-sm leading-6 text-slate-300">
                {section.items.map((item) => (
                  <li
                    key={item}
                    className="rounded-2xl border border-slate-800/70 bg-slate-900/45 px-4 py-3"
                  >
                    {item}
                  </li>
                ))}
              </ul>
            </SurfaceCard>
          ))}
        </div>
      </div>
    </div>
  );
}
