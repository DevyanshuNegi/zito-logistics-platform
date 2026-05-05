'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { LifeBuoy, ArrowRight } from 'lucide-react';
import { SurfaceCard } from '@/components/layout/SurfaceCard';
import { StatCard } from '@/components/layout/StatCard';
import { Input } from '@/components/ui/Input';
import type { HelpCenterGuide } from '@/lib/help-center';

type AppGuidePageProps = {
  guide: HelpCenterGuide;
  backHref?: string;
  backLabel?: string;
};

function normalize(value: string) {
  return value.trim().toLowerCase();
}

export function AppGuidePage({
  guide,
  backHref,
  backLabel = 'Back',
}: AppGuidePageProps) {
  const [query, setQuery] = useState('');
  const normalizedQuery = normalize(query);

  const filteredQuickActions = useMemo(() => {
    if (!normalizedQuery) {
      return guide.quickActions;
    }

    return guide.quickActions.filter((action) =>
      [action.title, action.description, ...action.keywords]
        .join(' ')
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }, [guide.quickActions, normalizedQuery]);

  const filteredRoles = useMemo(() => {
    if (!normalizedQuery) {
      return guide.roles;
    }

    return guide.roles.filter((role) =>
      [role.title, role.summary, ...role.highlights].join(' ').toLowerCase().includes(normalizedQuery),
    );
  }, [guide.roles, normalizedQuery]);

  const filteredArticles = useMemo(() => {
    if (!normalizedQuery) {
      return guide.articles;
    }

    return guide.articles.filter((article) =>
      [article.title, article.description, ...article.items, ...article.keywords]
        .join(' ')
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }, [guide.articles, normalizedQuery]);

  const topicChips = useMemo(
    () => guide.articles.map((article) => article.title).slice(0, 8),
    [guide.articles],
  );

  const hasResults =
    filteredQuickActions.length > 0 || filteredRoles.length > 0 || filteredArticles.length > 0;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.14),_transparent_24%),radial-gradient(circle_at_bottom_right,_rgba(59,130,246,0.16),_transparent_26%),linear-gradient(180deg,_#06101f_0%,_#081223_100%)] px-4 py-8 text-slate-100 sm:px-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <SurfaceCard
          title={guide.title}
          description={guide.subtitle}
          actions={
            <div className="flex flex-wrap items-center gap-3">
              {backHref ? (
                <Link
                  href={backHref}
                  className="inline-flex items-center rounded-2xl border border-slate-700/70 bg-slate-900/60 px-4 py-2 text-sm font-medium text-slate-100 transition hover:border-slate-500/80 hover:bg-slate-900/90"
                >
                  {backLabel}
                </Link>
              ) : null}
              <Link
                href={guide.supportAction.href}
                className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-500 via-blue-500 to-violet-500 px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
              >
                <LifeBuoy className="h-4 w-4" />
                {guide.supportAction.ctaLabel}
              </Link>
            </div>
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
          <div className="mt-6 rounded-3xl border border-slate-700/50 bg-slate-950/45 p-4">
            <Input
              label="Search the Help Center"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search OTP, booking, invoice, verification, fleet, warehouse..."
              help="Searches actions, roles, and article content across this app surface."
            />
            <div className="mt-5 flex flex-wrap gap-2">
              {topicChips.map((topic) => (
                <button
                  key={topic}
                  type="button"
                  onClick={() => setQuery(topic)}
                  className="rounded-full border border-slate-700/70 bg-slate-900/55 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:border-cyan-400/60 hover:text-white"
                >
                  {topic}
                </button>
              ))}
            </div>
          </div>
        </SurfaceCard>

        <SurfaceCard
          title="Quick actions"
          description="Start from the right operational entry point before escalating to human support."
        >
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {filteredQuickActions.map((action) => (
              <div
                key={action.title}
                className="rounded-3xl border border-slate-700/40 bg-slate-950/45 p-5"
              >
                <p className="text-lg font-semibold text-white">{action.title}</p>
                <p className="mt-3 text-sm leading-6 text-slate-300">{action.description}</p>
                <Link
                  href={action.href}
                  className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-cyan-200 transition hover:text-cyan-100"
                >
                  {action.ctaLabel}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            ))}
          </div>
        </SurfaceCard>

        <SurfaceCard
          title={guide.audienceLabel}
          description="Role-by-role summary of who uses this app surface and what they should do here."
        >
          <div className="grid gap-4 lg:grid-cols-2">
            {filteredRoles.map((role) => (
              <div
                key={role.title}
                className="rounded-3xl border border-slate-700/40 bg-slate-950/45 p-5"
              >
                <h3 className="text-lg font-semibold text-white">{role.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-300">{role.summary}</p>
                <ul className="mt-4 space-y-2 text-sm text-slate-300">
                  {role.highlights.map((item) => (
                    <li
                      key={item}
                      className="rounded-2xl border border-slate-800/70 bg-slate-900/45 px-4 py-3"
                    >
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </SurfaceCard>

        <SurfaceCard
          title="Help articles"
          description="Searchable workflow guidance, organized by article instead of one long static page."
        >
          {!hasResults ? (
            <div className="rounded-3xl border border-dashed border-slate-700/60 bg-slate-950/35 px-5 py-6 text-sm text-slate-300">
              No help results matched your search. Try another keyword, or open human support below.
            </div>
          ) : null}

          <div className="grid gap-6 lg:grid-cols-2">
            {filteredArticles.map((article) => (
              <SurfaceCard
                key={article.title}
                title={article.title}
                description={article.description}
                className="h-full border-slate-700/40 bg-slate-950/35"
              >
                <ul className="space-y-3 text-sm leading-6 text-slate-300">
                  {article.items.map((item) => (
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
        </SurfaceCard>

        <SurfaceCard
          title="Need more help?"
          description="Escalate into human support when the article is not enough or the workflow needs action."
        >
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-3xl border border-slate-700/40 bg-slate-950/45 p-5">
              <p className="text-lg font-semibold text-white">{guide.supportAction.title}</p>
              <p className="mt-3 text-sm leading-6 text-slate-300">{guide.supportAction.description}</p>
              <Link
                href={guide.supportAction.href}
                className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-500 via-blue-500 to-violet-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
              >
                {guide.supportAction.ctaLabel}
              </Link>
            </div>
            {guide.secondaryAction ? (
              <div className="rounded-3xl border border-slate-700/40 bg-slate-950/45 p-5">
                <p className="text-lg font-semibold text-white">{guide.secondaryAction.title}</p>
                <p className="mt-3 text-sm leading-6 text-slate-300">
                  {guide.secondaryAction.description}
                </p>
                <Link
                  href={guide.secondaryAction.href}
                  className="mt-5 inline-flex items-center gap-2 rounded-2xl border border-slate-700/70 bg-slate-900/55 px-4 py-2.5 text-sm font-semibold text-slate-100 transition hover:border-slate-500/80 hover:bg-slate-900/90"
                >
                  {guide.secondaryAction.ctaLabel}
                </Link>
              </div>
            ) : null}
          </div>
        </SurfaceCard>
      </div>
    </div>
  );
}
