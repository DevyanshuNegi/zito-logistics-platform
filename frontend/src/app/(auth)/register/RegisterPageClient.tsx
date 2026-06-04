'use client';

import Link from 'next/link';
import { Eye, EyeOff } from 'lucide-react';
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

type PasswordFieldProps = {
  label: string;
  value: string;
  visible: boolean;
  placeholder?: string;
  error?: string;
  help?: string;
  autoComplete: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  onToggle: () => void;
};

function LoadingLabel({ children }: { children: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span
        aria-hidden="true"
        className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
      />
      {children}
    </span>
  );
}

function PasswordField({
  label,
  value,
  visible,
  placeholder,
  error,
  help,
  autoComplete,
  onChange,
  onBlur,
  onToggle,
}: PasswordFieldProps) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium text-slate-200">{label}</span>
      <div className="relative">
        <input
          className={[
            'h-[46px] w-full rounded-2xl border bg-slate-950/60 px-4 py-3 pr-12 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1',
            error
              ? 'border-rose-400/80 focus:border-rose-300 focus:ring-rose-500/40'
              : 'border-slate-700/70 focus:border-cyan-400/80 focus:ring-violet-500/40',
          ].join(' ')}
          type={visible ? 'text' : 'password'}
          placeholder={placeholder}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onBlur={onBlur}
          autoComplete={autoComplete}
          required
        />
        <button
          type="button"
          aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          className="absolute right-3 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-slate-300 transition hover:bg-slate-800 hover:text-white focus:outline-none focus:ring-2 focus:ring-cyan-400/50"
          onClick={onToggle}
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {error ? <span className="text-xs text-rose-300">{error}</span> : null}
      {!error && help ? <span className="text-xs text-slate-400">{help}</span> : null}
    </label>
  );
}

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
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [touched, setTouched] = useState({
    companyName: false,
    fullName: false,
    email: false,
    phoneNumber: false,
    password: false,
    confirmPassword: false,
  });
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
  const normalizedEmail = email.trim().toLowerCase();
  const isEmailValid =
    normalizedEmail.length === 0 || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail);
  const registrationPhone = buildPhoneContact(
    selectedCountryOption?.dialCode ?? DEFAULT_COUNTRY_CODE,
    normalizedPhone,
  );
  const needsCompanyName = ORGANIZATION_ROLES.has(role);
  const passwordChecks = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    number: /\d/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  };
  const passwordScore = Object.values(passwordChecks).filter(Boolean).length;
  const passwordStrength =
    password.length === 0
      ? 'Empty'
      : passwordScore <= 1
        ? 'Weak'
        : passwordScore <= 3
          ? 'Good'
          : 'Strong';
  const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword;
  const fieldErrors = {
    companyName:
      touched.companyName && needsCompanyName && companyName.trim().length === 0
        ? 'Company name is required.'
        : '',
    fullName:
      touched.fullName && fullName.trim().length === 0
        ? needsCompanyName
          ? 'Authorized contact name is required.'
          : 'Full name is required.'
        : '',
    email: touched.email && !isEmailValid ? 'Enter a valid email address.' : '',
    phoneNumber:
      touched.phoneNumber && normalizedPhone.length < 7
        ? 'Enter a valid phone number.'
        : '',
    password:
      touched.password && password.length === 0
        ? 'Password is required.'
        : touched.password && !passwordChecks.length
          ? 'Use at least 8 characters.'
        : '',
    confirmPassword:
      touched.confirmPassword && confirmPassword.length === 0
        ? 'Confirm your password.'
        : touched.confirmPassword && confirmPassword.length > 0 && !passwordsMatch
          ? 'Passwords do not match.'
          : '',
  };
  const canSubmit =
    !submitting &&
    (!needsCompanyName || companyName.trim().length > 0) &&
    fullName.trim().length > 0 &&
    isEmailValid &&
    normalizedPhone.length >= 7 &&
    passwordChecks.length &&
    confirmPassword.length > 0 &&
    passwordsMatch;

  useEffect(() => {
    if (!loading && user) {
      router.replace(getRoleHomePath(user.role, user.staffScope));
    }
  }, [loading, router, user]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTouched({
      companyName: true,
      fullName: true,
      email: true,
      phoneNumber: true,
      password: true,
      confirmPassword: true,
    });
    if (!canSubmit) {
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      const response = await api.post<RegisterResponse>('/auth/register', {
        fullName,
        companyName: needsCompanyName ? companyName.trim() : undefined,
        email: normalizedEmail ? normalizedEmail : undefined,
        phone: registrationPhone,
        password: password.trim(),
        role,
      });

      savePendingRegistration({
        id: response.data.id,
        fullName,
        companyName: needsCompanyName ? companyName.trim() : undefined,
        email: normalizedEmail ? normalizedEmail : undefined,
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
      subtitle="Your account will be activated after verification and approval."
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
            onChange={(event) => {
              setCompanyName(event.target.value);
              setError(null);
            }}
            onBlur={() => setTouched((current) => ({ ...current, companyName: true }))}
            error={fieldErrors.companyName}
            required
          />
        ) : null}

        <Input
          label={needsCompanyName ? 'Authorized contact name' : 'Full name'}
          placeholder="Jane Mwangi"
          value={fullName}
          onChange={(event) => {
            setFullName(event.target.value);
            setError(null);
          }}
          onBlur={() => setTouched((current) => ({ ...current, fullName: true }))}
          error={fieldErrors.fullName}
          required
        />

        <Input
          label="Email"
          type="email"
          placeholder="name@company.com"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            setError(null);
          }}
          onBlur={() => setTouched((current) => ({ ...current, email: true }))}
          error={fieldErrors.email}
        />

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <div className="sm:w-[132px] sm:shrink-0">
            <CountryCodeSelect
              label="Country code"
              value={countryOptionCode}
              onChange={(nextCode) => {
                setCountryOptionCode(nextCode);
                setError(null);
              }}
              compact
            />
          </div>
          <div className="sm:min-w-0 sm:flex-1">
            <Input
              label="Phone number"
              placeholder="9876543210"
              value={phoneNumber}
              onChange={(event) => {
                setPhoneNumber(normalizePhoneNumber(event.target.value));
                setError(null);
              }}
              onBlur={() => setTouched((current) => ({ ...current, phoneNumber: true }))}
              autoComplete="tel-national"
              inputMode="numeric"
              help="Enter the local number without the country code."
              error={fieldErrors.phoneNumber}
              required
            />
          </div>
        </div>

        <div className="space-y-3">
          <PasswordField
            label="Password"
            placeholder="Create a secure password"
            value={password}
            visible={showPassword}
            autoComplete="new-password"
            onChange={(value) => {
              setPassword(value);
              setError(null);
            }}
            onBlur={() => setTouched((current) => ({ ...current, password: true }))}
            onToggle={() => setShowPassword((current) => !current)}
            error={fieldErrors.password}
            help="Use 8+ characters with letters and numbers."
          />

          <div className="rounded-2xl border border-slate-800/80 bg-slate-950/45 p-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-semibold text-slate-300">Password strength</span>
              <span
                className={[
                  'text-xs font-semibold',
                  passwordStrength === 'Strong'
                    ? 'text-emerald-300'
                    : passwordStrength === 'Good'
                      ? 'text-cyan-300'
                      : passwordStrength === 'Weak'
                        ? 'text-amber-300'
                        : 'text-slate-400',
                ].join(' ')}
              >
                {passwordStrength}
              </span>
            </div>
            <div className="mt-3 grid grid-cols-4 gap-1">
              {[1, 2, 3, 4].map((step) => (
                <span
                  key={step}
                  className={[
                    'h-1.5 rounded-full',
                    passwordScore >= step ? 'bg-cyan-400' : 'bg-slate-800',
                  ].join(' ')}
                />
              ))}
            </div>
            <div className="mt-3 grid gap-2 text-[11px] text-slate-400 sm:grid-cols-2">
              <span className={passwordChecks.length ? 'text-emerald-300' : ''}>
                8+ characters
              </span>
              <span className={passwordChecks.uppercase ? 'text-emerald-300' : ''}>
                Uppercase recommended
              </span>
              <span className={passwordChecks.number ? 'text-emerald-300' : ''}>
                Number recommended
              </span>
              <span className={passwordChecks.special ? 'text-emerald-300' : ''}>
                Special character recommended
              </span>
            </div>
          </div>

          <PasswordField
            label="Confirm password"
            placeholder="Re-enter your password"
            value={confirmPassword}
            visible={showConfirmPassword}
            autoComplete="new-password"
            onChange={(value) => {
              setConfirmPassword(value);
              setError(null);
            }}
            onBlur={() => setTouched((current) => ({ ...current, confirmPassword: true }))}
            onToggle={() => setShowConfirmPassword((current) => !current)}
            error={fieldErrors.confirmPassword}
            help="Must match the password above."
          />
        </div>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-200">Role</span>
          <select
            className="w-full rounded-2xl border border-slate-700/70 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 focus:border-cyan-400/80 focus:outline-none focus:ring-1 focus:ring-violet-500/40"
            value={role}
            onChange={(event) => {
              setSelectedRole(event.target.value);
              setError(null);
            }}
          >
            {portal.roleOptions.map((option) => (
              <option key={option.role} value={option.role}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <Button className="w-full" disabled={!canSubmit} type="submit">
          {submitting ? <LoadingLabel>Creating account...</LoadingLabel> : 'Register'}
        </Button>
      </form>
    </AuthShell>
  );
}
