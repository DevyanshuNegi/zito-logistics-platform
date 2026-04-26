'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import axios from 'axios';
import { LogIn, ShieldCheck, ArrowRight, Loader2, Phone, Mail, RefreshCw } from 'lucide-react';

// PRD §3 — Three login methods: Phone OTP (primary), Email + Password, Email OTP (fallback)
type LoginMethod = 'phone_otp' | 'email_password' | 'email_otp';

// PRD §3 — OTP security configuration (configurable per PRD)
const OTP_RESEND_COOLDOWN_SECONDS = 30;
const MAX_RESEND_ATTEMPTS         = 5;
const MAX_VERIFY_ATTEMPTS         = 5;

// PRD §3 — Session continuity: persist OTP step across app close / network loss
const SESSION_TEMP_TOKEN     = 'zito_temp_token';
const SESSION_OTP_METHOD     = 'zito_otp_method';
const SESSION_OTP_IDENTIFIER = 'zito_otp_identifier';

// PRD §3 — Account lifecycle: only ACTIVE may log in; all others get descriptive error
const ACCOUNT_STATUS_MESSAGES: Record<string, string> = {
  pending:   'Your account is pending admin approval. Please wait for activation.',
  verified:  'Your account is verified but not yet active. Please contact support.',
  suspended: 'Your account has been suspended. Please contact support.',
  rejected:  'Your account application was rejected. Please contact support.',
};

// ── Zod Schemas ──────────────────────────────────────────────────────────────

const phoneOtpSchema = z.object({
  phone: z
    .string()
    .min(7, 'Phone number is required')
    .regex(/^\+?[0-9\s\-()+]{7,15}$/, 'Enter a valid phone number'),
});

const emailPasswordSchema = z.object({
  email:    z.string().email('Enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

const emailOtpSchema = z.object({
  email: z.string().email('Enter a valid email address'),
});

const otpSchema = z.object({
  otp: z
    .string()
    .length(6, 'OTP must be exactly 6 digits')
    .regex(/^\d{6}$/, 'OTP must be numeric'),
});

type PhoneOtpValues      = z.infer<typeof phoneOtpSchema>;
type EmailPasswordValues = z.infer<typeof emailPasswordSchema>;
type EmailOtpValues      = z.infer<typeof emailOtpSchema>;
type OtpFormValues       = z.infer<typeof otpSchema>;

// ── Component ─────────────────────────────────────────────────────────────────

export default function LoginPage() {
  const router = useRouter();

  const [loginMethod, setLoginMethod]       = useState<LoginMethod>('phone_otp');
  const [step, setStep]                     = useState<'credentials' | 'otp'>('credentials');
  const [tempToken, setTempToken]           = useState<string | null>(null);
  const [otpIdentifier, setOtpIdentifier]   = useState<string>('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendAttempts, setResendAttempts] = useState(0);
  const [verifyAttempts, setVerifyAttempts] = useState(0);
  const [showFallback, setShowFallback]     = useState(false);
  const [serverError, setServerError]       = useState<string | null>(null);

  // PRD §3 — Session continuity: restore in-progress OTP step on mount
  useEffect(() => {
    const savedToken      = sessionStorage.getItem(SESSION_TEMP_TOKEN);
    const savedMethod     = sessionStorage.getItem(SESSION_OTP_METHOD) as LoginMethod | null;
    const savedIdentifier = sessionStorage.getItem(SESSION_OTP_IDENTIFIER);
    if (savedToken && savedMethod && savedIdentifier) {
      setTempToken(savedToken);
      setLoginMethod(savedMethod);
      setOtpIdentifier(savedIdentifier);
      setStep('otp');
    }
  }, []);

  // Resend cooldown countdown
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setInterval(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearInterval(t);
  }, [resendCooldown]);

  // ── Forms ────────────────────────────────────────────────────────────────

  const {
    register: regPhone,
    handleSubmit: submitPhone,
    formState: { errors: phoneErr, isSubmitting: phoneLoading },
  } = useForm<PhoneOtpValues>({ resolver: zodResolver(phoneOtpSchema) });

  const {
    register: regEmailPwd,
    handleSubmit: submitEmailPwd,
    formState: { errors: emailPwdErr, isSubmitting: emailPwdLoading },
  } = useForm<EmailPasswordValues>({ resolver: zodResolver(emailPasswordSchema) });

  const {
    register: regEmailOtp,
    handleSubmit: submitEmailOtp,
    formState: { errors: emailOtpErr, isSubmitting: emailOtpLoading },
  } = useForm<EmailOtpValues>({ resolver: zodResolver(emailOtpSchema) });

  const {
    register: regOtp,
    handleSubmit: submitOtp,
    reset: resetOtp,
    formState: { errors: otpErr, isSubmitting: otpLoading },
  } = useForm<OtpFormValues>({ resolver: zodResolver(otpSchema) });

  // ── Helpers ───────────────────────────────────────────────────────────────

  const persistSession = (token: string, method: LoginMethod, identifier: string) => {
    sessionStorage.setItem(SESSION_TEMP_TOKEN, token);
    sessionStorage.setItem(SESSION_OTP_METHOD, method);
    sessionStorage.setItem(SESSION_OTP_IDENTIFIER, identifier);
  };

  const clearSession = () => {
    sessionStorage.removeItem(SESSION_TEMP_TOKEN);
    sessionStorage.removeItem(SESSION_OTP_METHOD);
    sessionStorage.removeItem(SESSION_OTP_IDENTIFIER);
  };

  // PRD §2 — one user may hold multiple roles → role selector if >1
  const handleRoleRedirect = (roles: string[]) => {
    if (!roles?.length) { router.push('/dashboard'); return; }
    if (roles.length === 1) { router.push(`/${roles[0].toLowerCase()}/dashboard`); return; }
    router.push('/select-role');
  };

  // PRD §3 — block non-ACTIVE accounts with descriptive error
  const checkAccountStatus = (status?: string): boolean => {
    if (status && status !== 'active') {
      setServerError(ACCOUNT_STATUS_MESSAGES[status] || 'Your account is not active. Please contact support.');
      return false;
    }
    return true;
  };

  const enterOtpStep = (token: string, method: LoginMethod, identifier: string) => {
    setTempToken(token);
    setOtpIdentifier(identifier);
    persistSession(token, method, identifier);
    setResendCooldown(OTP_RESEND_COOLDOWN_SECONDS);
    setResendAttempts(0);
    setVerifyAttempts(0);
    setShowFallback(false);
    setStep('otp');
  };

  const goBack = () => {
    clearSession();
    setStep('credentials');
    setTempToken(null);
    setServerError(null);
    setVerifyAttempts(0);
    setShowFallback(false);
    resetOtp();
  };

  // ── Step 1 handlers ───────────────────────────────────────────────────────

  // PRD §3 — Primary: Phone OTP
  const onPhoneOtp = async (data: PhoneOtpValues) => {
    setServerError(null);
    try {
      const res = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/auth/send-otp`,
        { phone: data.phone.trim(), method: 'phone_otp' },
      );
      enterOtpStep(res.data.data.temp_token, 'phone_otp', data.phone.trim());
    } catch (err: any) {
      if (!checkAccountStatus(err.response?.data?.data?.status)) return;
      setServerError(err.response?.data?.error?.message || 'Failed to send OTP. Please try again.');
    }
  };

  // PRD §3 — Email + Password
  const onEmailPassword = async (data: EmailPasswordValues) => {
    setServerError(null);
    try {
      const res = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/auth/login`,
        { email: data.email.toLowerCase().trim(), password: data.password },
      );
      enterOtpStep(res.data.data.temp_token, 'email_password', data.email.toLowerCase().trim());
    } catch (err: any) {
      if (!checkAccountStatus(err.response?.data?.data?.status)) return;
      setServerError(err.response?.data?.error?.message || 'Invalid credentials. Please try again.');
    }
  };

  // PRD §3 — Fallback: Email OTP
  const onEmailOtp = async (data: EmailOtpValues) => {
    setServerError(null);
    try {
      const res = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/auth/send-otp`,
        { email: data.email.toLowerCase().trim(), method: 'email_otp' },
      );
      enterOtpStep(res.data.data.temp_token, 'email_otp', data.email.toLowerCase().trim());
    } catch (err: any) {
      if (!checkAccountStatus(err.response?.data?.data?.status)) return;
      setServerError(err.response?.data?.error?.message || 'Failed to send OTP. Please try again.');
    }
  };

  // ── Step 2: Verify OTP ────────────────────────────────────────────────────

  const onVerifyOtp = async (data: OtpFormValues) => {
    setServerError(null);
    try {
      const res = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/auth/verify-otp`,
        { otp: data.otp },
        { headers: { Authorization: `Bearer ${tempToken}` } },
      );
      // PRD §3 — store final JWT; clear temp session
      localStorage.setItem('zito_token', res.data.data.token);
      clearSession();
      // PRD §2 — multi-role support
      const roles: string[] = res.data.data.user.roles ?? [res.data.data.user.role];
      handleRoleRedirect(roles);
    } catch (err: any) {
      const next = verifyAttempts + 1;
      setVerifyAttempts(next);
      // PRD §3 — max verify attempts → show fallback alternative login
      if (next >= MAX_VERIFY_ATTEMPTS) {
        setShowFallback(true);
        setServerError('Too many failed attempts. Please use an alternative login method below.');
      } else {
        setServerError(
          err.response?.data?.error?.message ||
          `Invalid OTP. ${MAX_VERIFY_ATTEMPTS - next} attempt(s) remaining.`,
        );
      }
    }
  };

  // PRD §3 — Resend OTP: cooldown + max resend attempts
  const onResendOtp = useCallback(async () => {
    if (resendCooldown > 0 || resendAttempts >= MAX_RESEND_ATTEMPTS) return;
    setServerError(null);
    try {
      const payload =
        loginMethod === 'phone_otp'
          ? { phone: otpIdentifier, method: 'phone_otp' }
          : { email: otpIdentifier, method: loginMethod };

      const res = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/auth/send-otp`,
        payload,
        { headers: { Authorization: `Bearer ${tempToken}` } },
      );
      const newToken = res.data.data.temp_token ?? tempToken!;
      setTempToken(newToken);
      persistSession(newToken, loginMethod, otpIdentifier);
      setResendAttempts((a) => a + 1);
      setResendCooldown(OTP_RESEND_COOLDOWN_SECONDS);
      setVerifyAttempts(0);
      resetOtp();
    } catch (err: any) {
      setServerError(err.response?.data?.error?.message || 'Failed to resend OTP.');
    }
  }, [resendCooldown, resendAttempts, loginMethod, otpIdentifier, tempToken, resetOtp]);

  // ── UI helpers ────────────────────────────────────────────────────────────

  const switchMethod = (m: LoginMethod) => { setLoginMethod(m); setServerError(null); };

  const identifierLabel =
    loginMethod === 'phone_otp' ? 'phone number' : 'email address';

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow-lg border border-gray-100 p-8">

        {/* Header */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center mb-4">
            <LogIn className="text-white w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">
            {step === 'credentials' ? 'Welcome Back' : 'Verify Identity'}
          </h1>
          <p className="text-sm text-gray-500 mt-1 text-center">
            {step === 'credentials'
              ? 'Log in to your ZITO super-app account'
              : `A 6-digit code has been sent to your ${identifierLabel}`}
          </p>
        </div>

        {/* Server error */}
        {serverError && (
          <div className="mb-6 bg-red-50 border-l-4 border-red-500 p-4 text-red-700 text-sm rounded-r-lg">
            {serverError}
          </div>
        )}

        {/* ── CREDENTIALS STEP ── */}
        {step === 'credentials' && (
          <>
            {/* PRD §3 — method tabs */}
            <div className="flex rounded-lg border border-gray-200 overflow-hidden mb-6">
              {(
                [
                  { key: 'phone_otp',     label: 'Phone OTP', Icon: Phone       },
                  { key: 'email_password', label: 'Email',     Icon: Mail        },
                  { key: 'email_otp',     label: 'Email OTP', Icon: ShieldCheck },
                ] as { key: LoginMethod; label: string; Icon: any }[]
              ).map(({ key, label, Icon }, i) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => switchMethod(key)}
                  className={`flex-1 py-2.5 text-sm font-medium flex items-center justify-center gap-1.5 transition-colors ${
                    i === 1 ? 'border-x border-gray-200' : ''
                  } ${loginMethod === key ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                </button>
              ))}
            </div>

            {/* Phone OTP */}
            {loginMethod === 'phone_otp' && (
              <form onSubmit={submitPhone(onPhoneOtp)} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone Number</label>
                  <input
                    type="tel"
                    {...regPhone('phone')}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none"
                    placeholder="+254 700 000 000"
                  />
                  {phoneErr.phone && (
                    <p className="text-red-500 text-xs mt-1.5">{phoneErr.phone.message}</p>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={phoneLoading}
                  className="w-full bg-blue-600 text-white font-medium py-2.5 px-4 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {phoneLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Send OTP <ArrowRight className="w-4 h-4" /></>}
                </button>
              </form>
            )}

            {/* Email + Password */}
            {loginMethod === 'email_password' && (
              <form onSubmit={submitEmailPwd(onEmailPassword)} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Email Address</label>
                  <input
                    type="email"
                    {...regEmailPwd('email')}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none"
                    placeholder="you@example.com"
                  />
                  {emailPwdErr.email && (
                    <p className="text-red-500 text-xs mt-1.5">{emailPwdErr.email.message}</p>
                  )}
                </div>
                <div>
                  <div className="flex justify-between mb-1.5">
                    <label className="text-sm font-medium text-gray-700">Password</label>
                    <button
                      type="button"
                      onClick={() => router.push('/forgot-password')}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <input
                    type="password"
                    {...regEmailPwd('password')}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none"
                    placeholder="••••••••"
                  />
                  {emailPwdErr.password && (
                    <p className="text-red-500 text-xs mt-1.5">{emailPwdErr.password.message}</p>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={emailPwdLoading}
                  className="w-full bg-blue-600 text-white font-medium py-2.5 px-4 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {emailPwdLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Continue <ArrowRight className="w-4 h-4" /></>}
                </button>
              </form>
            )}

            {/* Email OTP (fallback) */}
            {loginMethod === 'email_otp' && (
              <form onSubmit={submitEmailOtp(onEmailOtp)} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Email Address</label>
                  <input
                    type="email"
                    {...regEmailOtp('email')}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none"
                    placeholder="you@example.com"
                  />
                  {emailOtpErr.email && (
                    <p className="text-red-500 text-xs mt-1.5">{emailOtpErr.email.message}</p>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={emailOtpLoading}
                  className="w-full bg-blue-600 text-white font-medium py-2.5 px-4 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {emailOtpLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Send OTP <ArrowRight className="w-4 h-4" /></>}
                </button>
              </form>
            )}
          </>
        )}

        {/* ── OTP STEP ── */}
        {step === 'otp' && (
          <form onSubmit={submitOtp(onVerifyOtp)} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 text-center">
                Verification Code
              </label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                {...regOtp('otp')}
                autoFocus
                className="w-full p-4 border-2 border-gray-200 rounded-xl text-center text-2xl font-bold tracking-[0.5em] focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                placeholder="000000"
              />
              {otpErr.otp && (
                <p className="text-red-500 text-xs mt-2 text-center">{otpErr.otp.message}</p>
              )}
              {verifyAttempts > 0 && !showFallback && (
                <p className="text-amber-600 text-xs mt-2 text-center">
                  {MAX_VERIFY_ATTEMPTS - verifyAttempts} attempt(s) remaining
                </p>
              )}
            </div>

            {!showFallback && (
              <button
                type="submit"
                disabled={otpLoading}
                className="w-full bg-blue-600 text-white font-semibold py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-70"
              >
                {otpLoading
                  ? <Loader2 className="w-5 h-5 animate-spin" />
                  : <>Verify &amp; Log In <ShieldCheck className="w-5 h-5" /></>}
              </button>
            )}

            {/* PRD §3 — Resend OTP with cooldown and max attempt guard */}
            {!showFallback && (
              <div className="text-center">
                {resendAttempts < MAX_RESEND_ATTEMPTS ? (
                  <button
                    type="button"
                    onClick={onResendOtp}
                    disabled={resendCooldown > 0}
                    className="text-sm text-blue-600 hover:underline disabled:text-gray-400 disabled:no-underline flex items-center justify-center gap-1 mx-auto"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    {resendCooldown > 0 ? `Resend OTP in ${resendCooldown}s` : 'Resend OTP'}
                  </button>
                ) : (
                  <p className="text-xs text-gray-500">Maximum resend attempts reached.</p>
                )}
              </div>
            )}

            {/* PRD §3 — Fallback after max verify attempts */}
            {showFallback && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-center space-y-3">
                <p className="text-sm text-amber-800 font-medium">Too many failed OTP attempts</p>
                <p className="text-xs text-amber-700">Please use an alternative login method.</p>
                <button
                  type="button"
                  onClick={() => { goBack(); switchMethod('email_password'); }}
                  className="w-full bg-blue-600 text-white text-sm font-medium py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Login with Email &amp; Password
                </button>
                <button
                  type="button"
                  onClick={() => { goBack(); switchMethod('email_otp'); }}
                  className="w-full bg-white text-blue-600 text-sm font-medium py-2 px-4 rounded-lg border border-blue-600 hover:bg-blue-50 transition-colors"
                >
                  Login with Email OTP
                </button>
              </div>
            )}

            <div className="text-center">
              <button
                type="button"
                onClick={goBack}
                className="text-sm text-gray-500 hover:text-blue-600 transition-colors"
              >
                ← Back to login
              </button>
            </div>
          </form>
        )}

        {/* Footer */}
        <div className="mt-8 pt-6 border-t border-gray-100 text-center">
          <p className="text-sm text-gray-600">
            New to ZITO?{' '}
            <button
              type="button"
              onClick={() => router.push('/register')}
              className="text-blue-600 hover:underline font-semibold"
            >
              Create an account
            </button>
          </p>
        </div>
      </div>
    </main>
  );
}