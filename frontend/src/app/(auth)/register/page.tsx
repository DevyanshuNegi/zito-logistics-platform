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
import { ROLE_PICKER_OPTIONS } from '@/lib/phase-one';
import { getRoleHomePath } from '@/lib/roles';

type RegisterResponse = {
  data: {
    id: string;
    status: string;
  };
};

const fallbackRole = 'CUSTOMER';

export default function RegisterPage() {
  const router = useRouter();
  const { user, loading, savePendingRegistration } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState(fallbackRole);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      router.replace(getRoleHomePath(user.role));
    }
  }, [loading, router, user]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const queryRole = new URLSearchParams(window.location.search).get('role');
    if (queryRole) {
      setRole(queryRole);
    }
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const response = await api.post<RegisterResponse>('/auth/register', {
        fullName,
        email: email || undefined,
        phone,
        password: password || undefined,
        role,
      });

      savePendingRegistration({
        id: response.data.id,
        fullName,
        email: email || undefined,
        phone,
        role,
        status: response.data.status,
      });

      router.push('/pending-approval');
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Registration failed.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      eyebrow="Registration"
      title={`Create your ${BRAND.appName} account`}
      subtitle="Every new account goes through approval before sign-in opens automatically."
      footer={
        <p>
          Already have an account?{' '}
          <Link href="/login" className="text-cyan-200 hover:text-cyan-100">
            Go to login
          </Link>
          .
        </p>
      }
    >
      <form className="space-y-4" onSubmit={handleSubmit}>
        {error ? (
          <Alert title="Registration blocked" variant="danger">
            {error}
          </Alert>
        ) : null}

        <Input
          label="Full name"
          placeholder="Jane Mwangi"
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
          required
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Email"
            type="email"
            placeholder="name@company.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <Input
            label="Phone"
            placeholder="+254700000000"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            required
          />
        </div>

        <Input
          label="Password"
          type="password"
          placeholder="At least 6 characters"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          help="Optional for registration. Login uses a one-time code."
        />

        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-200">Role</span>
          <select
            className="w-full rounded-2xl border border-slate-700/70 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 focus:border-cyan-400/80 focus:outline-none focus:ring-1 focus:ring-violet-500/40"
            value={role}
            onChange={(event) => setRole(event.target.value)}
          >
            {[fallbackRole, ...ROLE_PICKER_OPTIONS.map((option) => option.role)]
              .filter((value, index, array) => array.indexOf(value) === index)
              .map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
          </select>
        </label>

        <Button className="w-full" disabled={submitting} type="submit">
          {submitting ? 'Creating account...' : 'Register'}
        </Button>
      </form>
    </AuthShell>
  );
}
