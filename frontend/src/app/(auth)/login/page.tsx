'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { AuthShell } from '@/components/layout/AuthShell';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { CountryCodeSelect } from '@/components/ui/CountryCodeSelect';
import { Input } from '@/components/ui/Input';
import { useAuth } from '@/hooks/useAuth';
import { ApiError, api, consumeSessionNotice } from '@/lib/api';
import {
  getPortalConfig,
  getPortalKindFromPathname,
  getPortalKindForRole,
  type PortalKind,
} from '@/lib/auth-portals';
import {
  buildPhoneContact,
  DEFAULT_COUNTRY_CODE,
  maskContact,
  normalizeCountryCode,
  normalizePhoneNumber,
  secondsUntil,
  type LoginMode,
} from '@/lib/auth-login';
import {
  DEFAULT_COUNTRY_ISO_CODE,
  findCountryCodeOptionByDialCode,
  findCountryCodeOptionByIsoCode,
} from '@/lib/country-codes';
import { getRoleHomePath } from '@/lib/roles';

type SessionUser = {
  id: string;
  email?: string | null;
  phone?: string | null;
  fullName?: string | null;
  companyName?: string | null;
  role: string;
  staffScope?: string | null;
  staffDepartment?: string | null;
  staffAgencyName?: string | null;
};

type OtpRequestResponse = {
  data: {
    temp_token: string;
    contact: string;
    otpExpiresAt?: string | null;
    resendAvailableAt?: string | null;
    resendRemaining?: number;
  };
};

type LoginSuccessResponse = {
  data: {
    token: string;
    refreshToken?: string | null;
    user: SessionUser;
  };
};

type OtpPasswordGateResponse = {
  data: {
    requiresPassword: true;
    temp_token: string;
    contact: string;
  };
};

type OtpVerificationResponse = LoginSuccessResponse | OtpPasswordGateResponse;

type LoginStep = 'contact' | 'otp' | 'password';

type ErrorData = {
  status?: string;
  cooldownRemaining?: number;
  attemptsRemaining?: number;
  resendAvailableAt?: string | null;
  resendRemaining?: number;
};

function extractErrorData(error: ApiError): ErrorData {
  const details = error.details as { data?: ErrorData } | undefined;
  return details?.data ?? {};
}

function isPasswordGateResponse(
  response: OtpVerificationResponse,
): response is OtpPasswordGateResponse {
  return response.data != null && 'requiresPassword' in response.data;
}

function loginFooter(portalKind: PortalKind) {
  const portal = getPortalConfig(portalKind);

  if (portalKind === 'internal') {
    return (
      <div className="space-y-2">
        <p>
          Agency, branch, or station staff?{' '}
          <Link href="/agency/login" className="text-cyan-200 hover:text-cyan-100">
            Use Zito Agency
          </Link>
          .
        </p>
        <p>
          <Link href={portal.guideHref} className="text-cyan-200 hover:text-cyan-100">
            Need help? Open the internal guide.
          </Link>
        </p>
      </div>
    );
  }

  if (portalKind === 'agency') {
    return (
      <div className="space-y-2">
        <p>
          Head office or admin team?{' '}
          <Link href="/internal/login" className="text-cyan-200 hover:text-cyan-100">
            Use Zito Internal
          </Link>
          .
        </p>
        <p>
          <Link href={portal.guideHref} className="text-cyan-200 hover:text-cyan-100">
            Need help? Open the agency guide.
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p>
        New here?{' '}
        <Link href={portal.selectRolePath} className="text-cyan-200 hover:text-cyan-100">
          {portal.registerCta}
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
      <p>
        <Link href={portal.guideHref} className="text-cyan-200 hover:text-cyan-100">
          Need help? Open the user guide.
        </Link>
      </p>
    </div>
  );
}

function LoginPageScreen() {
  const pathname = usePathname();
  const router = useRouter();
  const portalKind = getPortalKindFromPathname(pathname);
  const portal = getPortalConfig(portalKind);
  const {
    user,
    loading,
    otpSession,
    saveOtpSession,
    clearOtp,
    login,
    savePendingRegistration,
  } = useAuth();
  const [step, setStep] = useState<LoginStep>('contact');
  const [mode, setMode] = useState<LoginMode>('phone_otp');
  const [countryOptionCode, setCountryOptionCode] = useState(DEFAULT_COUNTRY_ISO_CODE);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [approvalStatus, setApprovalStatus] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [requestingOtp, setRequestingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [submittingPassword, setSubmittingPassword] = useState(false);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const [attemptsRemaining, setAttemptsRemaining] = useState<number | null>(null);
  const [resendRemaining, setResendRemaining] = useState<number | null>(null);

  const selectedCountryOption =
    findCountryCodeOptionByIsoCode(countryOptionCode) ??
    findCountryCodeOptionByDialCode(DEFAULT_COUNTRY_CODE);
  const normalizedEmail = useMemo(() => email.trim().toLowerCase(), [email]);
  const normalizedDialCode = useMemo(
    () => normalizeCountryCode(selectedCountryOption?.dialCode ?? DEFAULT_COUNTRY_CODE),
    [selectedCountryOption],
  );
  const normalizedLocalPhone = useMemo(() => normalizePhoneNumber(phoneNumber), [phoneNumber]);
  const currentContact = useMemo(() => {
    if (mode === 'phone_otp') {
      return normalizedLocalPhone
        ? buildPhoneContact(normalizedDialCode, normalizedLocalPhone)
        : '';
    }
    return normalizedEmail;
  }, [mode, normalizedDialCode, normalizedEmail, normalizedLocalPhone]);

  useEffect(() => {
    if (!loading && user) {
      router.replace(getRoleHomePath(user.role, user.staffScope));
    }
  }, [loading, router, user]);

  useEffect(() => {
    const sessionNotice = consumeSessionNotice();
    if (!sessionNotice) {
      return;
    }

    setInfoMessage(sessionNotice);
    setError(null);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    if (params.get('reason') !== 'session-expired') {
      return;
    }

    setInfoMessage('Your session expired. Please sign in again.');
    setError(null);
  }, []);

  useEffect(() => {
    if (cooldownRemaining <= 0) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      setCooldownRemaining((current) => (current <= 1 ? 0 : current - 1));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [cooldownRemaining]);

  useEffect(() => {
    if (loading || user) {
      return;
    }

    if (!otpSession) {
      setStep('contact');
      setOtp('');
      setPassword('');
      setResendRemaining(null);
      return;
    }

    setStep(otpSession.stage === 'password' ? 'password' : 'otp');
    setMode(otpSession.mode);
    setEmail(otpSession.email ?? (otpSession.contact.includes('@') ? otpSession.contact : ''));
    setCountryOptionCode(
      otpSession.countryOptionCode ??
        findCountryCodeOptionByDialCode(otpSession.countryCode ?? DEFAULT_COUNTRY_CODE)
          ?.isoCode ??
        DEFAULT_COUNTRY_ISO_CODE,
    );
    setPhoneNumber(
      otpSession.phoneNumber ??
        (!otpSession.contact.includes('@') ? otpSession.contact.replace(/\D/g, '') : ''),
    );
    setCooldownRemaining(secondsUntil(otpSession.resendAvailableAt));
    setResendRemaining(
      typeof otpSession.resendRemaining === 'number' ? otpSession.resendRemaining : null,
    );
    setInfoMessage(
      otpSession.stage === 'password'
        ? 'OTP verified. Enter your email password to complete sign-in.'
        : null,
    );
  }, [loading, otpSession, user]);

  function clearTransientState() {
    setError(null);
    setApprovalStatus(null);
    setInfoMessage(null);
    setAttemptsRemaining(null);
  }

  function saveApprovalDraft(identifier: string, status?: string | null) {
    if (!status) {
      return;
    }

    savePendingRegistration({
      id: identifier,
      email: identifier.includes('@') ? identifier : undefined,
      phone: identifier.includes('@') ? undefined : identifier,
      status,
    });
  }

  function applyApiError(error: ApiError, identifier: string) {
    const data = extractErrorData(error);
    const status = data.status ?? null;
    setError(error.message);
    setApprovalStatus(status);
    setAttemptsRemaining(
      typeof data.attemptsRemaining === 'number' ? data.attemptsRemaining : null,
    );
    setResendRemaining(
      typeof data.resendRemaining === 'number' ? data.resendRemaining : null,
    );

    if (typeof data.cooldownRemaining === 'number') {
      setCooldownRemaining(data.cooldownRemaining);
    } else if (data.resendAvailableAt) {
      setCooldownRemaining(secondsUntil(data.resendAvailableAt));
    }

    saveApprovalDraft(identifier, status);
  }

  async function requestOtp() {
    clearTransientState();
    setRequestingOtp(true);

    try {
      const response = await api.post<OtpRequestResponse>('/auth/login', {
        contact: currentContact,
        method: 'otp',
      });

      saveOtpSession({
        tempToken: response.data.temp_token,
        contact: response.data.contact,
        mode,
        stage: 'otp',
        email: mode === 'email_otp' ? normalizedEmail : null,
        countryCode: mode === 'phone_otp' ? normalizedDialCode : null,
        countryOptionCode: mode === 'phone_otp' ? selectedCountryOption?.isoCode ?? null : null,
        phoneNumber: mode === 'phone_otp' ? normalizedLocalPhone : null,
        resendAvailableAt: response.data.resendAvailableAt ?? null,
        resendRemaining: response.data.resendRemaining ?? null,
        otpExpiresAt: response.data.otpExpiresAt ?? null,
      });

      setStep('otp');
      setOtp('');
      setPassword('');
      setCooldownRemaining(secondsUntil(response.data.resendAvailableAt));
      setResendRemaining(
        typeof response.data.resendRemaining === 'number'
          ? response.data.resendRemaining
          : null,
      );
      setInfoMessage(`A 6-digit code has been sent to ${maskContact(response.data.contact)}.`);
    } catch (caught) {
      if (caught instanceof ApiError) {
        applyApiError(caught, currentContact);
      } else {
        setError('Unable to send a login code right now.');
      }
    } finally {
      setRequestingOtp(false);
    }
  }

  async function handleContactSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await requestOtp();
  }

  async function handleResendCode() {
    await requestOtp();
  }

  async function handleVerifyOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!otpSession) {
      setError('Your login session expired. Request a fresh code.');
      setStep('contact');
      return;
    }

    setError(null);
    setApprovalStatus(null);
    setVerifyingOtp(true);

    try {
      const response = await api.post<OtpVerificationResponse>(
        '/auth/verify-otp',
        { otp },
        {
          headers: { Authorization: `Bearer ${otpSession.tempToken}` },
          token: '',
        },
      );

      if (isPasswordGateResponse(response)) {
        saveOtpSession({
          tempToken: response.data.temp_token,
          contact: response.data.contact,
          mode: 'email_otp',
          stage: 'password',
          email: normalizedEmail || response.data.contact,
          countryCode: null,
          countryOptionCode: null,
          phoneNumber: null,
          resendAvailableAt: null,
          otpExpiresAt: null,
        });
        setStep('password');
        setOtp('');
        setPassword('');
        setCooldownRemaining(0);
        setResendRemaining(null);
        setInfoMessage('OTP verified. Enter your email password to complete sign-in.');
        return;
      }

      login({
        user: {
          id: response.data.user.id,
          email: response.data.user.email,
          phone: response.data.user.phone,
          fullName: response.data.user.fullName,
          companyName: response.data.user.companyName,
          role: response.data.user.role,
          staffScope: response.data.user.staffScope,
          staffDepartment: response.data.user.staffDepartment,
          staffAgencyName: response.data.user.staffAgencyName,
        },
        accessToken: response.data.token,
        refreshToken: response.data.refreshToken ?? null,
      });

      setInfoMessage(
        portalKind !== getPortalKindForRole(response.data.user.role, response.data.user.staffScope)
          ? `This account belongs in ${getPortalConfig(getPortalKindForRole(response.data.user.role, response.data.user.staffScope)).productName}. Redirecting now.`
          : null,
      );
      router.replace(getRoleHomePath(response.data.user.role, response.data.user.staffScope));
    } catch (caught) {
      if (caught instanceof ApiError) {
        applyApiError(caught, otpSession.contact);
      } else {
        setError('OTP verification failed.');
      }
    } finally {
      setVerifyingOtp(false);
    }
  }

  async function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!otpSession) {
      setError('Your login session expired. Start again.');
      setStep('contact');
      return;
    }

    setError(null);
    setApprovalStatus(null);
    setSubmittingPassword(true);

    try {
      const response = await api.post<LoginSuccessResponse>(
        '/auth/complete-email-login',
        { password },
        {
          headers: { Authorization: `Bearer ${otpSession.tempToken}` },
          token: '',
        },
      );

      login({
        user: {
          id: response.data.user.id,
          email: response.data.user.email,
          phone: response.data.user.phone,
          fullName: response.data.user.fullName,
          companyName: response.data.user.companyName,
          role: response.data.user.role,
          staffScope: response.data.user.staffScope,
          staffDepartment: response.data.user.staffDepartment,
          staffAgencyName: response.data.user.staffAgencyName,
        },
        accessToken: response.data.token,
        refreshToken: response.data.refreshToken ?? null,
      });

      setInfoMessage(
        portalKind !== getPortalKindForRole(response.data.user.role, response.data.user.staffScope)
          ? `This account belongs in ${getPortalConfig(getPortalKindForRole(response.data.user.role, response.data.user.staffScope)).productName}. Redirecting now.`
          : null,
      );
      router.replace(getRoleHomePath(response.data.user.role, response.data.user.staffScope));
    } catch (caught) {
      if (caught instanceof ApiError) {
        applyApiError(caught, otpSession.contact);
      } else {
        setError('Unable to complete email sign-in right now.');
      }
    } finally {
      setSubmittingPassword(false);
    }
  }

  function resetToContactStep(nextMode: LoginMode = mode) {
    clearOtp();
    setStep('contact');
    setMode(nextMode);
    setOtp('');
    setPassword('');
    setCooldownRemaining(0);
    setResendRemaining(null);
    clearTransientState();
  }

  const verificationTarget = otpSession?.contact ?? currentContact;
  const maskedVerificationTarget = verificationTarget ? maskContact(verificationTarget) : '';
  const canSubmitContact =
    mode === 'phone_otp'
      ? normalizedDialCode.length > 1 && normalizedLocalPhone.length >= 6
      : normalizedEmail.length > 0;
  const canVerifyOtp = otp.length === 6;
  const canSubmitPassword = password.trim().length >= 6;

  return (
    <AuthShell
      eyebrow={portal.eyebrow}
      title={portal.title}
      subtitle={portal.subtitle}
      panelEyebrow={portal.panelEyebrow}
      panelTitle={portal.panelTitle}
      panelSubtitle={portal.panelSubtitle}
      footer={loginFooter(portalKind)}
    >
      {step === 'contact' ? (
        <form className="space-y-5" onSubmit={handleContactSubmit}>
          <div className="grid grid-cols-2 gap-2 rounded-3xl border border-slate-700/40 bg-slate-900/45 p-1">
            <button
              type="button"
              className={[
                'rounded-2xl px-4 py-2.5 text-sm font-semibold transition',
                mode === 'phone_otp'
                  ? 'bg-gradient-to-r from-cyan-500 via-blue-500 to-violet-500 text-white'
                  : 'text-slate-300 hover:bg-slate-800/70',
              ].join(' ')}
              onClick={() => {
                clearTransientState();
                setMode('phone_otp');
                setPassword('');
              }}
            >
              Phone OTP
            </button>
            <button
              type="button"
              className={[
                'rounded-2xl px-4 py-2.5 text-sm font-semibold transition',
                mode === 'email_otp'
                  ? 'bg-gradient-to-r from-cyan-500 via-blue-500 to-violet-500 text-white'
                  : 'text-slate-300 hover:bg-slate-800/70',
              ].join(' ')}
              onClick={() => {
                clearTransientState();
                setMode('email_otp');
              }}
            >
              Email
            </button>
          </div>

          {infoMessage ? (
            <Alert variant="success" title="Session update">
              {infoMessage}
            </Alert>
          ) : null}

          {error ? (
            <Alert variant={approvalStatus ? 'warning' : 'danger'} title="Sign-in blocked">
              {error}
            </Alert>
          ) : null}

          {approvalStatus ? (
            <Alert title="Approval still pending" variant="info">
              Your account status is {approvalStatus}. Review the approval guidance, then
              try again after activation.
              <div className="mt-3">
                <Link href="/pending-approval" className="text-amber-100 underline">
                  Open pending approval page
                </Link>
              </div>
            </Alert>
          ) : null}

          {mode === 'phone_otp' ? (
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
                  required
                />
              </div>
            </div>
          ) : (
            <Input
              label="Email address"
              type="email"
              placeholder="name@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="username"
              required
            />
          )}

          <Button className="w-full" disabled={requestingOtp || !canSubmitContact} type="submit">
            {requestingOtp ? 'Sending code...' : 'Continue'}
          </Button>
        </form>
      ) : null}

      {step === 'otp' ? (
        <form className="space-y-4" onSubmit={handleVerifyOtp}>
          {infoMessage ? (
            <Alert title="Code sent" variant="success">
              {infoMessage}
            </Alert>
          ) : null}

          {error ? (
            <Alert title="Verification failed" variant="danger">
              {error}
            </Alert>
          ) : null}

          {attemptsRemaining !== null ? (
            <Alert title="Verification attempts" variant="warning">
              {attemptsRemaining > 0
                ? `${attemptsRemaining} attempt${attemptsRemaining === 1 ? '' : 's'} remaining before temporary lock.`
                : 'No attempts remain right now. Wait for the temporary lock to expire before trying again.'}
            </Alert>
          ) : null}

          <div className="rounded-3xl border border-slate-700/40 bg-slate-900/55 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
              Verification target
            </p>
            <p className="mt-2 text-lg font-semibold text-white">{maskedVerificationTarget}</p>
            <p className="mt-2 text-xs text-slate-400">
              Enter the one-time code sent to the masked destination above.
            </p>
            <button
              type="button"
              className="mt-3 text-sm text-cyan-200 transition hover:text-cyan-100"
              onClick={() => resetToContactStep(otpSession?.mode ?? mode)}
            >
              Change email or phone
            </button>
          </div>

          <Input
            label="6-digit code"
            placeholder="123456"
            value={otp}
            onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
            maxLength={6}
            inputMode="numeric"
            autoComplete="one-time-code"
            className="text-center text-2xl font-semibold tracking-[0.45em]"
            help={
              otpSession?.mode === 'email_otp'
                ? 'After OTP verification, email users continue to password confirmation.'
                : 'Use the latest code sent to your phone.'
            }
            required
          />

          <div className="rounded-3xl border border-slate-700/40 bg-slate-900/55 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-white">Didn&apos;t receive the code?</p>
                <p className="mt-1 text-xs text-slate-400">
                  {cooldownRemaining > 0
                    ? `You can request a new OTP in ${cooldownRemaining}s.`
                    : 'You can request a fresh OTP now.'}
                </p>
                {resendRemaining !== null ? (
                  <p className="mt-2 text-xs text-slate-400">
                    OTP requests left in this cycle: {resendRemaining}
                  </p>
                ) : null}
              </div>
              <Button
                className="sm:min-w-[160px]"
                disabled={requestingOtp || cooldownRemaining > 0}
                type="button"
                variant="secondary"
                onClick={() => {
                  void handleResendCode();
                }}
              >
                {cooldownRemaining > 0
                  ? `Resend in ${cooldownRemaining}s`
                  : requestingOtp
                    ? 'Sending...'
                    : 'Resend OTP'}
              </Button>
            </div>
          </div>

          <div className="grid gap-3">
            <Button className="w-full" disabled={verifyingOtp || !canVerifyOtp} type="submit">
              {verifyingOtp ? 'Verifying...' : 'Verify code'}
            </Button>
          </div>
        </form>
      ) : null}

      {step === 'password' ? (
        <form className="space-y-4" onSubmit={handlePasswordSubmit}>
          {infoMessage ? (
            <Alert title="OTP verified" variant="success">
              {infoMessage}
            </Alert>
          ) : null}

          {error ? (
            <Alert title="Password required" variant="danger">
              {error}
            </Alert>
          ) : null}

          <div className="rounded-3xl border border-slate-700/40 bg-slate-900/55 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
              Email sign-in
            </p>
            <p className="mt-2 text-lg font-semibold text-white">{maskedVerificationTarget}</p>
            <p className="mt-2 text-xs text-slate-400">
              OTP is complete. Enter your email password to finish sign-in.
            </p>
            <button
              type="button"
              className="mt-3 text-sm text-cyan-200 transition hover:text-cyan-100"
              onClick={() => resetToContactStep('email_otp')}
            >
              Start again
            </button>
          </div>

          <Input
            label="Password"
            type="password"
            placeholder="Enter your email password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            help="Email users complete sign-in with password after OTP."
            required
          />

          <Button
            className="w-full"
            disabled={submittingPassword || !canSubmitPassword}
            type="submit"
          >
            {submittingPassword ? 'Signing in...' : 'Sign in'}
          </Button>
        </form>
      ) : null}
    </AuthShell>
  );
}

export default function LoginPage() {
  return <LoginPageScreen />;
}
