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

type LoginResponse = {
  data: {
    temp_token: string;
    contact: string;
    user?: {
      fullName?: string | null;
    };
  };
};

export default function LoginPage() {
  const router = useRouter();
  const { user, loading, saveOtpSession, savePendingRegistration } = useAuth();
  const [contact, setContact] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [approvalStatus, setApprovalStatus] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      router.replace(getRoleHomePath(user.role));
    }
  }, [loading, router, user]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setApprovalStatus(null);
    setSubmitting(true);

    try {
      const response = await api.post<LoginResponse>('/auth/login', {
        contact,
        password: password || undefined,
        method: password ? 'email_password' : 'otp',
      });

      saveOtpSession(response.data.temp_token, response.data.contact);
      router.push('/verify-otp');
    } catch (caught) {
      if (caught instanceof ApiError) {
        const details = caught.details as { data?: { status?: string } } | undefined;
        const status = details?.data?.status ?? null;
        setError(caught.message);
        setApprovalStatus(status);

        if (status) {
          savePendingRegistration({
            id: contact,
            email: contact.includes('@') ? contact : undefined,
            phone: contact.includes('@') ? undefined : contact,
            status,
          });
        }
      } else {
        setError('Unable to start login right now.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      eyebrow="Unified Login"
      title={`Continue into ${BRAND.appName}`}
      subtitle={`Use your phone or email. ${BRAND.companyName} keeps the account approval workflow separate from the app sign-in experience.`}
      footer={
        <p>
          New here?{' '}
          <Link href="/select-role" className="text-cyan-200 hover:text-violet-200">
            Start registration
          </Link>
          .
        </p>
      }
    >
      <form className="space-y-4" onSubmit={handleSubmit}>
        {error ? (
          <Alert variant={approvalStatus ? 'warning' : 'danger'} title="Login blocked">
            {error}
          </Alert>
        ) : null}

        {approvalStatus ? (
          <Alert title="Approval still pending" variant="info">
            Your account status is {approvalStatus}. You can review the approval guidance
            and then try logging in again after activation.
            <div className="mt-3">
              <Link href="/pending-approval" className="text-amber-100 underline">
                Open pending approval page
              </Link>
            </div>
          </Alert>
        ) : null}

        <Input
          label="Email or phone"
          placeholder="name@company.com or +254700000000"
          value={contact}
          onChange={(event) => setContact(event.target.value)}
          required
        />

        <Input
          label="Password"
          type="password"
          placeholder="Leave blank for OTP-only flow"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          help={`If you leave this empty, ${BRAND.appName} will request OTP only.`}
        />

        <Button className="w-full" disabled={submitting} type="submit">
          {submitting ? 'Sending OTP...' : 'Continue'}
        </Button>
      </form>
    </AuthShell>
  );
}
