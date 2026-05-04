'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { CountryCodeSelect } from '@/components/ui/CountryCodeSelect';
import { Input } from '@/components/ui/Input';
import { AuthShell } from '@/components/layout/AuthShell';
import { useAuth } from '@/hooks/useAuth';
import { ApiError, api } from '@/lib/api';
import {
  getPortalConfig,
  getPortalKindFromPathname,
  ORGANIZATION_ROLES,
  resolvePortalRole,
  type PortalKind,
} from '@/lib/auth-portals';
import {
  buildPhoneContact,
  DEFAULT_COUNTRY_CODE,
  normalizePhoneNumber,
} from '@/lib/auth-login';
import {
  DEFAULT_COUNTRY_ISO_CODE,
  findCountryCodeOptionByDialCode,
  findCountryCodeOptionByIsoCode,
} from '@/lib/country-codes';
import { getRoleHomePath } from '@/lib/roles';

type RegisterResponse = {
  data: {
    id: string;
    status: string;
  };
};

type RegisterPageClientProps = {
  initialRole?: string | null;
  portalKind?: PortalKind;
};

export default function RegisterPageClient({
  initialRole,
  portalKind,
}: RegisterPageClientProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, savePendingRegistration } = useAuth();
  const resolvedPortalKind = portalKind ?? getPortalKindFromPathname(pathname);
  const portal = getPortalConfig(resolvedPortalKind);
  const [companyName, setCompanyName] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [countryOptionCode, setCountryOptionCode] = useState(DEFAULT_COUNTRY_ISO_CODE);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const requestedRole = useMemo(() => resolvePortalRole(resolvedPortalKind, initialRole), [
    initialRole,
    resolvedPortalKind,
  ]);
  const role = selectedRole ?? requestedRole;
  const selectedCountryOption =
    findCountryCodeOptionByIsoCode(countryOptionCode) ??
    findCountryCodeOptionByDialCode(DEFAULT_COUNTRY_CODE);
  const normalizedPhone = normalizePhoneNumber(phoneNumber);
  const registrationPhone = buildPhoneContact(
    selectedCountryOption?.dialCode ?? DEFAULT_COUNTRY_CODE,
    normalizedPhone,
  );
  const needsCompanyName = ORGANIZATION_ROLES.has(role);

  useEffect(() => {
    if (!loading && user) {
      router.replace(getRoleHomePath(user.role));
    }
  }, [loading, router, user]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const response = await api.post<RegisterResponse>('/auth/register', {
        fullName,
        companyName: needsCompanyName ? companyName.trim() : undefined,
        email: email.trim() ? email.trim().toLowerCase() : undefined,
        phone: registrationPhone,
        password: password.trim(),
        role,
      });

      savePendingRegistration({
        id: response.data.id,
        fullName,
        companyName: needsCompanyName ? companyName.trim() : undefined,
        email: email.trim() ? email.trim().toLowerCase() : undefined,
        phone: registrationPhone,
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
      title={`Create your ${portal.productName} account`}
      subtitle="Every new account goes through approval before sign-in opens automatically."
      panelEyebrow={portal.panelEyebrow}
      panelTitle={portal.panelTitle}
      panelSubtitle={portal.panelSubtitle}
      footer={
        <div className="space-y-2">
          <p>
            Already have an account?{' '}
            <Link href={portal.loginPath} className="text-cyan-200 hover:text-cyan-100">
              Go to login
            </Link>
            .
          </p>
          {portal.switchCta ? (
            <p>
              <Link href={portal.switchHref} className="text-cyan-200 hover:text-cyan-100">
                {portal.switchCta}
              </Link>
            </p>
          ) : null}
        </div>
      }
    >
      <form className="space-y-4" onSubmit={handleSubmit}>
        {error ? (
          <Alert title="Registration blocked" variant="danger">
            {error}
          </Alert>
        ) : null}

        {needsCompanyName ? (
          <Input
            label="Company name"
            placeholder="Acme Logistics Ltd"
            value={companyName}
            onChange={(event) => setCompanyName(event.target.value)}
            required
          />
        ) : null}

        <Input
          label={needsCompanyName ? 'Authorized contact name' : 'Full name'}
          placeholder="Jane Mwangi"
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
          required
        />

        <Input
          label="Email"
          type="email"
          placeholder="name@company.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <div className="sm:w-[132px] sm:shrink-0">
            <CountryCodeSelect
              label="Country code"
              value={countryOptionCode}
              onChange={setCountryOptionCode}
              compact
            />
          </div>
          <div className="sm:min-w-0 sm:flex-1">
            <Input
              label="Phone number"
              placeholder="9876543210"
              value={phoneNumber}
              onChange={(event) => setPhoneNumber(normalizePhoneNumber(event.target.value))}
              autoComplete="tel-national"
              inputMode="numeric"
              help="Enter the local number without the country code."
              required
            />
          </div>
        </div>

        <Input
          label="Password"
          type="password"
          placeholder="At least 6 characters"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          help="Required for email sign-in after OTP verification."
          required
        />

        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-200">Role</span>
          <select
            className="w-full rounded-2xl border border-slate-700/70 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 focus:border-cyan-400/80 focus:outline-none focus:ring-1 focus:ring-violet-500/40"
            value={role}
            onChange={(event) => setSelectedRole(event.target.value)}
          >
            {portal.roleOptions.map((option) => (
              <option key={option.role} value={option.role}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <Button
          className="w-full"
          disabled={
            submitting ||
            (needsCompanyName && companyName.trim().length === 0) ||
            fullName.trim().length === 0 ||
            normalizedPhone.length < 6 ||
            password.trim().length < 6
          }
          type="submit"
        >
          {submitting ? 'Creating account...' : 'Register'}
        </Button>
      </form>
    </AuthShell>
  );
}
