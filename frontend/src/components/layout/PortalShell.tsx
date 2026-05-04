'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { BrandLockup } from '@/components/layout/BrandLockup';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { useAuth } from '@/hooks/useAuth';
import { getGuidePathForRole } from '@/lib/auth-portals';
import { getRoleHomePath, hasAnyRole } from '@/lib/roles';

type NavItem = {
  href: string;
  label: string;
};

type PortalShellProps = {
  title: string;
  allowedRoles: string[];
  navItems: NavItem[];
  children: ReactNode;
};

export function PortalShell({
  title,
  allowedRoles,
  navItems,
  children,
}: PortalShellProps) {
  const t = useTranslations('Shell');
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, logout } = useAuth();
  const canAccess = !!user && hasAnyRole(user.role, allowedRoles);
  const workspaceHome = navItems[0]?.href ?? getRoleHomePath(user?.role);
  const currentNavItem =
    navItems
      .filter((item) => pathname === item.href || pathname?.startsWith(`${item.href}/`))
      .sort((left, right) => right.href.length - left.href.length)[0] ?? navItems[0];
  const mobileSectionLabel = currentNavItem?.label ?? title;
  const mobileBackHref =
    pathname && pathname !== workspaceHome
      ? currentNavItem && pathname !== currentNavItem.href
        ? currentNavItem.href
        : workspaceHome
      : null;

  useEffect(() => {
    if (loading) return;

    let fallbackTimer: number | undefined;

    if (!user) {
      router.replace('/login');
      fallbackTimer = window.setTimeout(() => {
        if (window.location.pathname !== '/login') {
          window.location.replace('/login');
        }
      }, 120);
      return () => {
        if (fallbackTimer) {
          window.clearTimeout(fallbackTimer);
        }
      };
    }

    if (!hasAnyRole(user.role, allowedRoles)) {
      router.replace('/unauthorized');
      fallbackTimer = window.setTimeout(() => {
        if (window.location.pathname !== '/unauthorized') {
          window.location.replace('/unauthorized');
        }
      }, 120);
      return () => {
        if (fallbackTimer) {
          window.clearTimeout(fallbackTimer);
        }
      };
    }

    return () => {
      if (fallbackTimer) {
        window.clearTimeout(fallbackTimer);
      }
    };
  }, [allowedRoles, loading, router, user]);

  if (loading || !user || !canAccess) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="min-h-screen text-slate-100">
      <div className="mx-auto flex min-h-screen max-w-7xl gap-6 px-4 py-6 sm:px-6">
        <aside className="hidden w-72 shrink-0 rounded-3xl border border-slate-700/40 bg-slate-950/55 p-5 shadow-2xl backdrop-blur lg:block">
          <div className="mb-8 flex items-start justify-between gap-4">
            <div className="space-y-3">
              <BrandLockup compact showDescriptor={false} />
              <div>
                <h1 className="mt-1 text-2xl font-semibold text-white">{title}</h1>
                <p className="mt-1 text-xs uppercase tracking-[0.24em] text-slate-400">
                  Zito Workspace
                </p>
              </div>
            </div>
            <Badge variant="brand">{user?.role ?? 'Guest'}</Badge>
          </div>

          <nav className="space-y-2">
            {navItems.map((item) => {
              const active = pathname === item.href || pathname?.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={[
                    'block rounded-2xl border px-4 py-3 text-sm font-medium transition',
                    active
                      ? 'border-cyan-400/40 bg-violet-500/15 text-cyan-100 shadow-lg shadow-cyan-500/10'
                      : 'border-slate-800/80 bg-slate-900/50 text-slate-300 hover:border-slate-600/70 hover:bg-slate-900/80',
                  ].join(' ')}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-8 rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-4 text-sm text-slate-300">
            <p className="font-medium text-sky-100">{user?.fullName ?? t('signedIn')}</p>
            <p className="mt-1 text-xs text-slate-400">{user?.email ?? user?.phone ?? t('activeSession')}</p>
            <Link
              href={getGuidePathForRole(user?.role)}
              className="mt-4 inline-flex text-sm font-medium text-cyan-200 transition hover:text-cyan-100"
            >
              Open user guide
            </Link>
            <div className="mt-4 flex gap-2">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => router.push(getRoleHomePath(user?.role))}
              >
                {t('home')}
              </Button>
              <Button
                variant="danger"
                className="flex-1"
                onClick={() => {
                  logout();
                  router.push('/login');
                }}
              >
                {t('logOut')}
              </Button>
            </div>
          </div>
        </aside>

        <main className="flex-1">
          <header className="mb-6 rounded-3xl border border-slate-700/40 bg-slate-950/55 px-5 py-4 shadow-2xl backdrop-blur">
            <div className="mb-4 flex items-center justify-between gap-3 lg:hidden">
              {mobileBackHref ? (
                <Link
                  href={mobileBackHref}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-700/70 bg-slate-900/70 px-3 py-2 text-sm font-medium text-slate-100 transition hover:border-cyan-400/40 hover:text-cyan-100"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </Link>
              ) : (
                <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Workspace home</p>
              )}
              <Badge variant={mobileBackHref ? 'info' : 'success'}>{mobileSectionLabel}</Badge>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Zito Workspace</p>
                <h2 className="mt-1 text-2xl font-semibold text-white">{title}</h2>
                <p className="mt-1 text-sm text-slate-400">Operations portal</p>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant="info">{user?.role ?? 'Guest'}</Badge>
                <Badge variant="success">PRD v10</Badge>
              </div>
            </div>

            <div className="-mx-1 mt-4 flex gap-2 overflow-x-auto px-1 lg:hidden">
              {navItems.map((item) => {
                const active = pathname === item.href || pathname?.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={[
                      'whitespace-nowrap rounded-full border px-3 py-2 text-xs font-semibold transition',
                      active
                        ? 'border-cyan-400/40 bg-violet-500/15 text-cyan-100 shadow-lg shadow-cyan-500/10'
                        : 'border-slate-700/70 bg-slate-900/60 text-slate-300 hover:border-slate-500/70 hover:bg-slate-900/80',
                    ].join(' ')}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </header>

          {children}
        </main>
      </div>
    </div>
  );
}
