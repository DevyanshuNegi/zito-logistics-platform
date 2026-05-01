'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { AuthShell } from '@/components/layout/AuthShell';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useAuth } from '@/hooks/useAuth';
import { ApiError, api } from '@/lib/api';
import { BRAND } from '@/lib/brand';
import {
  buildPhoneContact,
  DEFAULT_COUNTRY_CODE,
  maskContact,
  normalizeCountryCode,
  normalizePhoneNumber,
  secondsUntil,
  type LoginMode,
} from '@/lib/auth-login';
import { getRoleHomePath } from '@/lib/roles';

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
    user: {
      id: string;
      email?: string | null;
      phone?: string | null;
      fullName?: string | null;
      role: string;
    };
  };
};

type LoginStep = 'contact' | 'otp';

type ErrorData = {
  status?: string;
  cooldownRemaining?: number;
  attemptsRemaining?: number;
  resendAvailableAt?: string | null;
  resendRemaining?: number;
  passwordFallbackEligible?: boolean;
};

function extractErrorData(error: ApiError): ErrorData {
  const details = error.details as { data?: ErrorData } | undefined;
  return details?.data ?? {};
}

export default function LoginPage() {
  const router = useRouter();
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
  const [countryCode, setCountryCode] = useState(DEFAULT_COUNTRY_CODE);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [approvalStatus, setApprovalStatus] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [requestingOtp, setRequestingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const [attemptsRemaining, setAttemptsRemaining] = useState<number | null>(null);
  const [passwordFallbackUnlocked, setPasswordFallbackUnlocked] = useState(false);

  const normalizedEmail = useMemo(() => email.trim().toLowerCase(), [email]);
  const normalizedDialCode = useMemo(() => normalizeCountryCode(countryCode), [countryCode]);
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
      router.replace(getRoleHomePath(user.role));
    }
  }, [loading, router, user]);

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
      return;
    }

    setStep('otp');
    setMode(otpSession.mode);
    setEmail(otpSession.email ?? (otpSession.contact.includes('@') ? otpSession.contact : ''));
    setCountryCode(otpSession.countryCode ?? DEFAULT_COUNTRY_CODE);
    setPhoneNumber(
      otpSession.phoneNumber ??
        (!otpSession.contact.includes('@') ? otpSession.contact.replace(/\D/g, '') : ''),
    );
    setCooldownRemaining(secondsUntil(otpSession.resendAvailableAt));
    setPasswordFallbackUnlocked(false);
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

    if (typeof data.cooldownRemaining === 'number') {
      setCooldownRemaining(data.cooldownRemaining);
    } else if (data.resendAvailableAt) {
      setCooldownRemaining(secondsUntil(data.resendAvailableAt));
    }

    if (data.passwordFallbackEligible) {
      setPasswordFallbackUnlocked(true);
    }

    saveApprovalDraft(identifier, status);
  }

  async function handleContactSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearTransientState();

    if (mode === 'email_password') {
      setRequestingOtp(true);
      try {
        const response = await api.post<LoginSuccessResponse>('/auth/login', {
          email: normalizedEmail,
          password,
          method: 'email_password',
        });

        login({
          user: {
            id: response.data.user.id,
            email: response.data.user.email,
            phone: response.data.user.phone,
            fullName: response.data.user.fullName,
            role: response.data.user.role,
          },
          accessToken: response.data.token,
          refreshToken: response.data.refreshToken ?? null,
        });

        router.replace(getRoleHomePath(response.data.user.role));
      } catch (caught) {
        if (caught instanceof ApiError) {
          applyApiError(caught, normalizedEmail);
        } else {
          setError('Unable to sign in with password right now.');
        }
      } finally {
        setRequestingOtp(false);
      }

      return;
    }

    setRequestingOtp(true);
    try {
      const response = await api.post<OtpRequestResponse>('/auth/login', {
        contact: currentContact,
        method: 'otp',
      });

      const otpMode: LoginMode = mode === 'phone_otp' ? 'phone_otp' : 'email_otp';
      saveOtpSession({
        tempToken: response.data.temp_token,
        contact: response.data.contact,
        mode: otpMode,
        email: otpMode === 'email_otp' ? normalizedEmail : null,
        countryCode: otpMode === 'phone_otp' ? normalizedDialCode : null,
        phoneNumber: otpMode === 'phone_otp' ? normalizedLocalPhone : null,
        resendAvailableAt: response.data.resendAvailableAt ?? null,
        otpExpiresAt: response.data.otpExpiresAt ?? null,
      });

      setStep('otp');
      setOtp('');
      setCooldownRemaining(secondsUntil(response.data.resendAvailableAt));
      setInfoMessage(`A 6-digit code has been sent to ${maskContact(response.data.contact)}.`);
      setPasswordFallbackUnlocked(false);
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
      const response = await api.post<LoginSuccessResponse>(
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
          phone: response.data.user.phone,
          fullName: response.data.user.fullName,
          role: response.data.user.role,
        },
        accessToken: response.data.token,
        refreshToken: response.data.refreshToken ?? null,
      });

      router.replace(getRoleHomePath(response.data.user.role));
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

  function resetToContactStep(nextMode: LoginMode = mode) {
    clearOtp();
    setStep('contact');
    setMode(nextMode);
    setOtp('');
    setCooldownRemaining(0);
    clearTransientState();
  }

  const verificationTarget = otpSession?.contact ?? currentContact;
  const maskedVerificationTarget = verificationTarget ? maskContact(verificationTarget) : '';
  const canSubmitContact =
    mode === 'phone_otp'
      ? normalizedDialCode.length > 1 && normalizedLocalPhone.length >= 6
      : mode === 'email_password'
        ? normalizedEmail.length > 0 && password.length > 0
        : normalizedEmail.length > 0;

  return (
    <AuthShell
      eyebrow="Sign In"
      title={`Sign in to ${BRAND.appName}`}
      subtitle="Use your phone number first, or switch to email if needed. We verify sign-in with a one-time code and keep the recovery path on the same screen."
      footer={
        <p>
          New here?{' '}
          <Link href="/select-role" className="text-cyan-200 hover:text-cyan-100">
            Start registration
          </Link>
          .
        </p>
      }
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
              }}
            >
              Phone OTP
            </button>
            <button
              type="button"
              className={[
                'rounded-2xl px-4 py-2.5 text-sm font-semibold transition',
                mode !== 'phone_otp'
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

          {mode !== 'phone_otp' ? (
            <div className="flex items-center gap-2 rounded-3xl border border-slate-700/40 bg-slate-900/40 p-1">
              <button
                type="button"
                className={[
                  'flex-1 rounded-2xl px-3 py-2 text-sm font-medium transition',
                  mode === 'email_otp'
                    ? 'bg-slate-100 text-slate-950'
                    : 'text-slate-300 hover:bg-slate-800/70',
                ].join(' ')}
                onClick={() => {
                  clearTransientState();
                  setMode('email_otp');
                }}
              >
                One-time code
              </button>
              <button
                type="button"
                className={[
                  'flex-1 rounded-2xl px-3 py-2 text-sm font-medium transition',
                  mode === 'email_password'
                    ? 'bg-slate-100 text-slate-950'
                    : 'text-slate-300 hover:bg-slate-800/70',
                ].join(' ')}
                disabled={!passwordFallbackUnlocked}
                onClick={() => {
                  clearTransientState();
                  setMode('email_password');
                }}
              >
                Email password
              </button>
            </div>
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
            <div className="grid gap-4 sm:grid-cols-[150px,1fr]">
              <Input
                label="Country code"
                placeholder="+91"
                value={countryCode}
                onChange={(event) => setCountryCode(normalizeCountryCode(event.target.value))}
                autoComplete="tel-country-code"
                required
              />
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

          {mode === 'email_password' ? (
            <Input
              label="Password"
              type="password"
              placeholder="Enter your account password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
          ) : null}

          {mode !== 'email_password' && mode !== 'phone_otp' && !passwordFallbackUnlocked ? (
            <p className="text-xs text-slate-400">
              Password sign-in becomes available here after OTP trouble on your email login.
            </p>
          ) : null}

          <Button className="w-full" disabled={requestingOtp || !canSubmitContact} type="submit">
            {requestingOtp
              ? mode === 'email_password'
                ? 'Signing in...'
                : 'Sending code...'
              : mode === 'email_password'
                ? 'Sign in with password'
                : 'Continue'}
          </Button>
        </form>
      ) : (
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
              Your one-time code was sent to the masked destination above.
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
            help="Use the latest code sent to your email or phone."
            required
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <Button className="w-full" disabled={verifyingOtp || otp.length !== 6} type="submit">
              {verifyingOtp ? 'Verifying...' : 'Verify code'}
            </Button>
            <Button
              className="w-full"
              disabled={requestingOtp || cooldownRemaining > 0}
              type="button"
              variant="secondary"
              onClick={() => {
                void handleContactSubmit({
                  preventDefault() {},
                } as FormEvent<HTMLFormElement>);
              }}
            >
              {cooldownRemaining > 0
                ? `Resend in ${cooldownRemaining}s`
                : requestingOtp
                  ? 'Sending...'
                  : 'Resend code'}
            </Button>
          </div>

          {passwordFallbackUnlocked && (otpSession?.mode ?? mode) === 'email_otp' ? (
            <Button
              className="w-full"
              type="button"
              variant="ghost"
              onClick={() => resetToContactStep('email_password')}
            >
              Use email and password instead
            </Button>
          ) : null}
        </form>
      )}
    </AuthShell>
  );
}
