'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { useAuth } from '@/hooks/useAuth';
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
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, logout } = useAuth();
  const canAccess = !!user && hasAnyRole(user.role, allowedRoles);

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.replace('/login');
      return;
    }

    if (!hasAnyRole(user.role, allowedRoles)) {
      router.replace('/unauthorized');
    }
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
          <div className="mb-8 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-sky-300/80">ZITO</p>
              <h1 className="mt-1 text-2xl font-semibold text-white">{title}</h1>
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
                      ? 'border-amber-400/50 bg-amber-500/15 text-amber-100 shadow-lg shadow-amber-500/10'
                      : 'border-slate-800/80 bg-slate-900/50 text-slate-300 hover:border-slate-600/70 hover:bg-slate-900/80',
                  ].join(' ')}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-8 rounded-2xl border border-sky-500/20 bg-sky-500/10 p-4 text-sm text-slate-300">
            <p className="font-medium text-sky-100">{user?.fullName ?? 'Signed in'}</p>
            <p className="mt-1 text-xs text-slate-400">{user?.email ?? user?.phone ?? 'Active session'}</p>
            <div className="mt-4 flex gap-2">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => router.push(getRoleHomePath(user?.role))}
              >
                Home
              </Button>
              <Button
                variant="danger"
                className="flex-1"
                onClick={() => {
                  logout();
                  router.push('/login');
                }}
              >
                Log Out
              </Button>
            </div>
          </div>
        </aside>

        <main className="flex-1">
          <header className="mb-6 rounded-3xl border border-slate-700/40 bg-slate-950/55 px-5 py-4 shadow-2xl backdrop-blur">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Phase 1 Portal</p>
                <h2 className="mt-1 text-2xl font-semibold text-white">{title}</h2>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant="info">{user?.role ?? 'Guest'}</Badge>
                <Badge variant="success">PRD v10</Badge>
              </div>
            </div>
          </header>

          {children}
        </main>
      </div>
    </div>
  );
}
