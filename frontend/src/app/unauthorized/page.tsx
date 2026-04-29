'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/hooks/useAuth';
import { getRoleHomePath } from '@/lib/roles';

export default function UnauthorizedPage() {
  const router = useRouter();
  const { user } = useAuth();
  const homePath = getRoleHomePath(user?.role);

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-lg rounded-[2rem] border border-slate-700/40 bg-slate-950/60 p-8 text-center shadow-2xl backdrop-blur">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border border-rose-400/30 bg-rose-500/10 text-3xl text-rose-200">
          !
        </div>
        <h1 className="mt-6 text-3xl font-semibold text-white">Access denied</h1>
        <p className="mt-3 text-sm leading-6 text-slate-300">
          This route is not available for your current role.
          {user?.role ? ` Signed in as ${user.role}.` : ' You are currently not signed in.'}
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button onClick={() => router.push(homePath)}>Go to home</Button>
          <Button variant="secondary" onClick={() => router.push('/login')}>
            Back to login
          </Button>
        </div>
      </div>
    </main>
  );
}
