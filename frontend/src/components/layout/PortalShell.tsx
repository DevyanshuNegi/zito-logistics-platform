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
import {
  getGuidePathForRole,
  getPortalConfig,
  type PortalKind,
} from '@/lib/auth-portals';
import { getRoleHomePath, hasAnyRole } from '@/lib/roles';

type NavItem = {
  href: string;
  label: string;
};

type PortalShellProps = {
  title: string;
  allowedRoles: string[];
  allowedStaffScopes?: string[];
  navItems: NavItem[];
  theme?: 'default' | 'operations';
  workspaceLabel?: string;
  headerEyebrow?: null | string;
  headerDescription?: string;
  headerTitleMode?: 'section' | 'workspace';
  showHeaderBadges?: boolean;
  showSidebarRolePill?: boolean;
  showSidebarHeading?: boolean;
  sidebarBrandCompact?: boolean;
  children: ReactNode;
};

export function PortalShell({
  title,
  allowedRoles,
  allowedStaffScopes,
  navItems,
  theme = 'default',
  workspaceLabel = 'Zito Workspace',
  headerEyebrow,
  headerDescription = 'Operations portal',
  headerTitleMode = 'workspace',
  showHeaderBadges = true,
  showSidebarRolePill = true,
  showSidebarHeading = true,
  sidebarBrandCompact = true,
  children,
}: PortalShellProps) {
  const t = useTranslations('Shell');
  const pathname = usePathname();
  const router = useRouter();
  const { user, accessToken, loading, logout } = useAuth();
  const isOperationsTheme = theme === 'operations';
  const expectedPortalKind: PortalKind =
    allowedRoles.length === 1 &&
    allowedRoles[0] === 'AGENCY_STAFF' &&
    allowedStaffScopes?.map((scope) => scope.trim().toUpperCase()).includes('AGENCY')
      ? 'agency'
      : allowedRoles.every((role) =>
            ['CUSTOMER', 'CORPORATE'].includes(role.trim().toUpperCase()),
          )
        ? 'service'
        : allowedRoles.every((role) =>
              [
                'DRIVER',
                'AGENT',
                'TRANSPORTER',
                'COURIER_COMPANY',
                'WAREHOUSE_PARTNER',
              ].includes(role.trim().toUpperCase()),
            )
          ? 'partners'
          : 'internal';
  const loginPath = getPortalConfig(expectedPortalKind).loginPath;
  const normalizedScope = (user?.staffScope ?? '').trim().toUpperCase();
  const scopeAllowed =
    !allowedStaffScopes ||
    !user ||
    user.role !== 'AGENCY_STAFF' ||
    allowedStaffScopes.map((scope) => scope.trim().toUpperCase()).includes(normalizedScope);
  const hasSession = !!user && !!accessToken;
  const canAccess = hasSession && hasAnyRole(user.role, allowedRoles) && scopeAllowed;
  const workspaceHome = navItems[0]?.href ?? getRoleHomePath(user?.role, user?.staffScope);
  const currentNavItem =
    navItems
      .filter((item) => pathname === item.href || pathname?.startsWith(`${item.href}/`))
      .sort((left, right) => right.href.length - left.href.length)[0] ?? navItems[0];
  const mobileSectionLabel = currentNavItem?.label ?? title;
  const headerTitle = headerTitleMode === 'section' ? currentNavItem?.label ?? title : title;
  const resolvedHeaderEyebrow =
    headerEyebrow === undefined ? workspaceLabel : headerEyebrow;
  const mobileBackHref =
    pathname && pathname !== workspaceHome
      ? currentNavItem && pathname !== currentNavItem.href
        ? currentNavItem.href
        : workspaceHome
      : null;

  useEffect(() => {
    if (loading) return;

    let fallbackTimer: number | undefined;

    if (!user || !accessToken) {
      router.replace(loginPath);
      fallbackTimer = window.setTimeout(() => {
        if (window.location.pathname !== loginPath) {
          window.location.replace(loginPath);
        }
      }, 120);
      return () => {
        if (fallbackTimer) {
          window.clearTimeout(fallbackTimer);
        }
      };
    }

    if (!hasAnyRole(user.role, allowedRoles) || !scopeAllowed) {
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
  }, [accessToken, allowedRoles, allowedStaffScopes, loading, loginPath, router, scopeAllowed, user]);

  if (loading || !user || !canAccess) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <Spinner />
      </div>
    );
  }

  const rolePill = isOperationsTheme ? (
    <span className="inline-flex rounded-full border border-[#d7e0ec] bg-[#f8fbff] px-3 py-1 text-xs font-semibold text-[#1b3f72]">
      {user?.role ?? 'Guest'}
    </span>
  ) : (
    <Badge variant="brand">{user?.role ?? 'Guest'}</Badge>
  );

  const sectionPill = (label: string, tone: 'info' | 'success') =>
    isOperationsTheme ? (
      <span
        className={[
          'inline-flex rounded-full border px-3 py-1 text-xs font-semibold',
          tone === 'success'
            ? 'border-[#d7e0ec] bg-[#fff8e8] text-[#a06c0f]'
            : 'border-[#cfe0ff] bg-[#eef4ff] text-[#1b3f72]',
        ].join(' ')}
      >
        {label}
      </span>
    ) : (
      <Badge variant={tone}>{label}</Badge>
    );

  return (
    <div
      className={[
        'min-h-screen',
        isOperationsTheme
          ? 'bg-[#f4f6fb] text-[#1a1a2e]'
          : 'text-slate-100',
      ].join(' ')}
    >
      <div className="mx-auto flex min-h-screen max-w-7xl gap-6 px-4 py-6 sm:px-6">
        <aside
          className={[
            'hidden w-72 shrink-0 rounded-3xl p-5 lg:block',
            isOperationsTheme
              ? 'border border-[#d7e0ec] bg-white shadow-[0_20px_60px_rgba(15,23,42,0.08)]'
              : 'border border-slate-700/40 bg-slate-950/55 shadow-2xl backdrop-blur',
          ].join(' ')}
        >
          <div className="mb-8 flex items-start justify-between gap-4">
            <div className="space-y-3">
              <BrandLockup compact={sidebarBrandCompact} showDescriptor={false} />
              {showSidebarHeading ? (
                <div>
                  <h1
                    className={[
                      'mt-1 text-2xl font-semibold',
                      isOperationsTheme ? 'text-[#1a1a2e]' : 'text-white',
                    ].join(' ')}
                  >
                    {title}
                  </h1>
                  <p
                    className={[
                      'mt-1 text-xs uppercase tracking-[0.24em]',
                      isOperationsTheme ? 'text-[#64748b]' : 'text-slate-400',
                    ].join(' ')}
                  >
                    {workspaceLabel}
                  </p>
                </div>
              ) : null}
            </div>
            {showSidebarRolePill ? rolePill : null}
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
                    isOperationsTheme
                      ? active
                        ? 'border-[#bfd2f0] bg-[#eef4ff] text-[#1b3f72] shadow-[0_10px_24px_rgba(27,63,114,0.08)]'
                        : 'border-[#d7e0ec] bg-[#f8fbff] text-[#475569] hover:border-[#bfd2f0] hover:bg-white'
                      : active
                        ? 'border-cyan-400/40 bg-violet-500/15 text-cyan-100 shadow-lg shadow-cyan-500/10'
                        : 'border-slate-800/80 bg-slate-900/50 text-slate-300 hover:border-slate-600/70 hover:bg-slate-900/80',
                  ].join(' ')}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div
            className={[
              'mt-8 rounded-2xl p-4 text-sm',
              isOperationsTheme
                ? 'border border-[#d7e0ec] bg-[#f8fbff] text-[#475569]'
                : 'border border-cyan-500/20 bg-cyan-500/10 text-slate-300',
            ].join(' ')}
          >
            <p
              className={[
                'font-medium',
                isOperationsTheme ? 'text-[#1a1a2e]' : 'text-sky-100',
              ].join(' ')}
            >
              {user?.fullName ?? t('signedIn')}
            </p>
            <p
              className={[
                'mt-1 text-xs',
                isOperationsTheme ? 'text-[#64748b]' : 'text-slate-400',
              ].join(' ')}
            >
              {user?.email ?? user?.phone ?? t('activeSession')}
            </p>
            <Link
              href={getGuidePathForRole(user?.role, user?.staffScope)}
              className={[
                'mt-4 inline-flex text-sm font-medium transition',
                isOperationsTheme
                  ? 'text-[#1b3f72] hover:text-[#15345c]'
                  : 'text-cyan-200 hover:text-cyan-100',
              ].join(' ')}
            >
              Open Help Center
            </Link>
            <div className="mt-4 flex gap-2">
              <Button
                variant="secondary"
                className={[
                  'flex-1',
                  isOperationsTheme
                    ? 'border border-[#d7e0ec] bg-white text-[#1a1a2e] hover:bg-[#eef4ff]'
                    : '',
                ].join(' ')}
                onClick={() => router.push(getRoleHomePath(user?.role, user?.staffScope))}
              >
                {t('home')}
              </Button>
              <Button
                variant="danger"
                className={[
                  'flex-1',
                  isOperationsTheme ? 'bg-[#b91c1c] text-white hover:bg-[#991b1b]' : '',
                ].join(' ')}
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
          <header
            className={[
              'mb-6 rounded-3xl px-5 py-4',
              isOperationsTheme
                ? 'border border-[#d7e0ec] bg-white shadow-[0_20px_60px_rgba(15,23,42,0.06)]'
                : 'border border-slate-700/40 bg-slate-950/55 shadow-2xl backdrop-blur',
            ].join(' ')}
          >
            <div className="mb-4 flex items-center justify-between gap-3 lg:hidden">
              {mobileBackHref ? (
                <Link
                  href={mobileBackHref}
                  className={[
                    'inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium transition',
                    isOperationsTheme
                      ? 'border-[#d7e0ec] bg-white text-[#1a1a2e] hover:border-[#bfd2f0] hover:text-[#1b3f72]'
                      : 'border-slate-700/70 bg-slate-900/70 text-slate-100 hover:border-cyan-400/40 hover:text-cyan-100',
                  ].join(' ')}
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </Link>
              ) : (
                <p
                  className={[
                    'text-xs uppercase tracking-[0.25em]',
                    isOperationsTheme ? 'text-[#64748b]' : 'text-slate-400',
                  ].join(' ')}
                >
                  Workspace home
                </p>
              )}
              {sectionPill(mobileSectionLabel, mobileBackHref ? 'info' : 'success')}
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                {resolvedHeaderEyebrow ? (
                  <p
                    className={[
                      'text-xs uppercase tracking-[0.25em]',
                      isOperationsTheme ? 'text-[#64748b]' : 'text-slate-400',
                    ].join(' ')}
                  >
                    {resolvedHeaderEyebrow}
                  </p>
                ) : null}
                <h2
                  className={[
                    resolvedHeaderEyebrow ? 'mt-1 text-2xl font-semibold' : 'text-2xl font-semibold',
                    isOperationsTheme ? 'text-[#1a1a2e]' : 'text-white',
                  ].join(' ')}
                >
                  {headerTitle}
                </h2>
                {headerDescription ? (
                  <p
                    className={[
                      'mt-1 text-sm',
                      isOperationsTheme ? 'text-[#64748b]' : 'text-slate-400',
                    ].join(' ')}
                  >
                    {headerDescription}
                  </p>
                ) : null}
              </div>
              {showHeaderBadges ? (
                <div className="flex items-center gap-3">
                  {sectionPill(user?.role ?? 'Guest', 'info')}
                </div>
              ) : null}
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
                      isOperationsTheme
                        ? active
                          ? 'border-[#bfd2f0] bg-[#eef4ff] text-[#1b3f72] shadow-[0_10px_24px_rgba(27,63,114,0.08)]'
                          : 'border-[#d7e0ec] bg-[#f8fbff] text-[#475569] hover:border-[#bfd2f0] hover:bg-white'
                        : active
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
