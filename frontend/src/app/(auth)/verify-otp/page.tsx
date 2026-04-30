'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { AuthShell } from '@/components/layout/AuthShell';
import { useAuth } from '@/hooks/useAuth';
import { ApiError, api } from '@/lib/api';
import { BRAND } from '@/lib/brand';
import { getRoleHomePath } from '@/lib/roles';

type VerifyOtpResponse = {
  data: {
    token: string;
    refreshToken?: string | null;
    user: {
      id: string;
      email?: string | null;
      fullName?: string | null;
      role: string;
    };
  };
};

export default function VerifyOtpPage() {
  const router = useRouter();
  const { user, loading, otpSession, login, clearOtp } = useAuth();
  const [otp, setOtp] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      router.replace(getRoleHomePath(user.role));
      return;
    }

    if (!loading && !otpSession) {
      router.replace('/login');
    }
  }, [loading, otpSession, router, user]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!otpSession) return;

    setError(null);
    setSubmitting(true);

    try {
      const response = await api.post<VerifyOtpResponse>(
        '/auth/verify-otp',
        { otp },
        {
          headers: { Authorization: `Bearer ${otpSession.tempToken}` },
          token: '',
        },
      );

      login({
        user: {
          id: response.data.user.id,
          email: response.data.user.email,
          fullName: response.data.user.fullName,
          role: response.data.user.role,
        },
        accessToken: response.data.token,
        refreshToken: response.data.refreshToken ?? null,
      });

      router.replace(getRoleHomePath(response.data.user.role));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'OTP verification failed.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      eyebrow="OTP Verification"
      title="Approve this sign-in"
      subtitle={`Enter the one-time code sent to ${otpSession?.contact ?? 'your account contact'}.`}
      footer={
        <p>
          Need a new code?{' '}
          <Link href="/login" className="text-cyan-200 hover:text-violet-200">
            Restart login
          </Link>
          .
        </p>
      }
    >
      <form className="space-y-4" onSubmit={handleSubmit}>
        {error ? (
          <Alert title="Verification failed" variant="danger">
            {error}
          </Alert>
        ) : null}

        <Input
          label="6-digit OTP"
          placeholder="123456"
          value={otp}
          onChange={(event) => setOtp(event.target.value)}
          maxLength={6}
          required
        />

        <div className="flex gap-3">
          <Button className="flex-1" disabled={submitting} type="submit">
            {submitting ? 'Verifying...' : 'Verify OTP'}
          </Button>
          <Button
            className="flex-1"
            type="button"
            variant="secondary"
            onClick={() => {
              clearOtp();
              router.push('/login');
            }}
          >
            Cancel
          </Button>
        </div>
      </form>
    </AuthShell>
  );
}
