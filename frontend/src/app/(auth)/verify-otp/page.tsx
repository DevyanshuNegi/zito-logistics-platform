'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Spinner } from '@/components/ui/Spinner';
import { AuthShell } from '@/components/layout/AuthShell';
import { useAuth } from '@/hooks/useAuth';
import { BRAND } from '@/lib/brand';

export default function VerifyOtpPage() {
  const router = useRouter();
  const { loading } = useAuth();

  useEffect(() => {
    if (!loading) {
      router.replace('/login');
    }
  }, [loading, router]);

  return (
    <AuthShell
      eyebrow="Sign In"
      title={`Continue to ${BRAND.appName}`}
      subtitle="Verification now happens directly on the login page. Redirecting you there now."
    >
      <div className="flex items-center gap-3 text-sm text-slate-300">
        <Spinner />
        <span>Loading login...</span>
      </div>
    </AuthShell>
  );
}
