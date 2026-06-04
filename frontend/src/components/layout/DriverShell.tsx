'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import {
  ArrowLeft,
  ClipboardList,
  MapPinned,
  User,
  Wallet,
} from 'lucide-react';
import { Spinner } from '@/components/ui/Spinner';
import { useAuth } from '@/hooks/useAuth';
import { BRAND } from '@/lib/brand';
import { hasAnyRole } from '@/lib/roles';

type NavItem = {
  href: string;
  label: string;
};

type DriverShellProps = {
  title: string;
  allowedRoles: string[];
  mobileNavItems: NavItem[];
  children: ReactNode;
};

function iconForNav(href: string) {
  if (href.includes('/earnings')) return Wallet;
  if (href.includes('/jobs')) return ClipboardList;
  if (href.includes('/shift')) return User;
  return MapPinned;
}

function getUserInitials(value?: string | null) {
  if (!value) {
    return 'ZT';
  }

  const parts = value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (parts.length === 0) {
    return 'ZT';
  }

  return parts.map((part) => part.charAt(0).toUpperCase()).join('');
}

function isActivePath(pathname: string | null, href: string) {
  return pathname === href || pathname?.startsWith(`${href}/`);
}

export function DriverShell({
  title,
  allowedRoles,
  mobileNavItems,
  children,
}: DriverShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useAuth();
  const mustCompleteVerification = Boolean(user?.status && user.status !== 'ACTIVE');
  const canAccess = !!user && hasAnyRole(user.role, allowedRoles) && !mustCompleteVerification;
  const currentItem = [...mobileNavItems]
    .sort((left, right) => right.href.length - left.href.length)
    .find((item) => isActivePath(pathname, item.href));
  const primaryHome = mobileNavItems[0]?.href ?? '/driver/dashboard';
  const isPrimaryTabView = mobileNavItems.some((item) => isActivePath(pathname, item.href));
  const secondaryBackHref =
    pathname?.startsWith('/driver/fleet')
      ? '/driver/shift'
      : pathname?.startsWith('/driver/heatmap')
        ? '/driver/dashboard'
        : primaryHome;
  const backHref =
    pathname && !isPrimaryTabView
      ? currentItem?.href ?? secondaryBackHref
      : null;
  const initials = getUserInitials(user?.fullName ?? user?.email ?? user?.phone);

  useEffect(() => {
    if (loading) return;

    let fallbackTimer: number | undefined;

    if (!user) {
      router.replace('/partners/login');
      fallbackTimer = window.setTimeout(() => {
        if (window.location.pathname !== '/partners/login') {
          window.location.replace('/partners/login');
        }
      }, 120);
      return () => {
        if (fallbackTimer) {
          window.clearTimeout(fallbackTimer);
        }
      };
    }

    if (mustCompleteVerification) {
      router.replace('/complete-verification');
      fallbackTimer = window.setTimeout(() => {
        if (window.location.pathname !== '/complete-verification') {
          window.location.replace('/complete-verification');
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
  }, [allowedRoles, loading, mustCompleteVerification, router, user]);

  if (loading || !user || !canAccess) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f4f6fb] px-4">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.14),transparent_24%),radial-gradient(circle_at_bottom_right,rgba(99,102,241,0.16),transparent_28%),linear-gradient(180deg,#06101f_0%,#0a1424_100%)] text-[#1a1a2e]">
      <div className="mx-auto flex min-h-screen w-full max-w-[430px] flex-col bg-[#f4f6fb] md:my-6 md:min-h-[calc(100vh-3rem)] md:rounded-[32px] md:border md:border-[#dbe4f0] md:shadow-[0_24px_72px_rgba(15,23,42,0.14)]">
        <header className="sticky top-0 z-20 bg-[linear-gradient(180deg,#06101f_0%,#081223_100%)] px-4 pb-3 pt-3 text-white shadow-[0_8px_18px_rgba(6,16,31,0.18)] md:rounded-t-[32px]">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              {backHref ? (
                <button
                  type="button"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/18 bg-white/10 text-sm font-semibold text-white transition hover:bg-white/16"
                  onClick={() => router.push(backHref)}
                  aria-label="Back"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
              ) : (
                <div className="rounded-[14px] border border-white/10 bg-white/[0.03] px-2 py-1.5">
                  <Image
                    src={BRAND.assets.appLogo}
                    alt={`${BRAND.appName} logo`}
                    width={82}
                    height={31}
                    className="h-auto w-[82px]"
                    priority
                  />
                </div>
              )}
              <div className="min-w-0">
                <p className="truncate text-[10px] font-semibold uppercase tracking-[0.24em] text-cyan-200/72">
                  Zito Partners
                </p>
                <p className="truncate text-sm font-semibold text-white">
                  {currentItem?.label ?? title}
                </p>
              </div>
            </div>

            <Link
              href="/driver/shift"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/18 bg-white/10 text-sm font-semibold text-white transition hover:bg-white/16"
              aria-label="Driver profile"
            >
              {initials}
            </Link>
          </div>
        </header>

        <main className="flex-1 px-3 pb-24 pt-2.5">{children}</main>

        <nav className="fixed bottom-0 left-1/2 z-30 flex w-full max-w-[430px] -translate-x-1/2 items-center border-t border-[#e7edf6] bg-white/98 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur">
          {mobileNavItems.map((item) => {
            const active = isActivePath(pathname, item.href);
            const Icon = iconForNav(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex min-w-0 flex-1 flex-col items-center gap-1 rounded-[14px] px-2 py-1.5 text-[10px] font-medium transition"
              >
                <span
                  className={[
                    'flex h-8 w-8 items-center justify-center rounded-full transition',
                    active
                      ? 'bg-gradient-to-r from-cyan-500 via-blue-500 to-violet-500 text-white shadow-[0_10px_20px_rgba(59,130,246,0.2)]'
                      : 'text-slate-500',
                  ].join(' ')}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <span className={active ? 'truncate font-semibold text-[#1b3f72]' : 'truncate text-slate-500'}>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
