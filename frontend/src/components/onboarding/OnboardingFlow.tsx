'use client';

import { FormEvent, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Building2,
  Check,
  Fingerprint,
  GitBranch,
  LockKeyhole,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  Sparkles,
  UserRound,
} from 'lucide-react';

type StepId = 'identity' | 'profile' | 'security' | 'review';

type FormState = {
  fullName: string;
  email: string;
  company: string;
  role: string;
  city: string;
  phone: string;
  loginMethod: 'biometric' | 'google' | 'email';
  accepted: boolean;
};

type FormErrors = Partial<Record<keyof FormState, string>>;

const steps: Array<{ id: StepId; title: string; helper: string }> = [
  { id: 'identity', title: 'Identity', helper: 'Start with a secure sign-in method.' },
  { id: 'profile', title: 'Profile', helper: 'Tell us how ZITO should configure your workspace.' },
  { id: 'security', title: 'Verification', helper: 'Choose contact details for protected updates.' },
  { id: 'review', title: 'Review', helper: 'Confirm everything before continuing.' },
];

const INITIAL_FORM: FormState = {
  fullName: '',
  email: '',
  company: '',
  role: '',
  city: '',
  phone: '',
  loginMethod: 'biometric',
  accepted: false,
};

function validateStep(step: StepId, values: FormState) {
  const errors: FormErrors = {};

  if (step === 'identity') {
    if (!values.fullName.trim()) errors.fullName = 'Enter your full name.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) {
      errors.email = 'Enter a valid work email.';
    }
  }

  if (step === 'profile') {
    if (!values.company.trim()) errors.company = 'Company or team name is required.';
    if (!values.role) errors.role = 'Select your primary role.';
    if (!values.city.trim()) errors.city = 'Add your operating city.';
  }

  if (step === 'security') {
    if (!/^\+?[0-9\s-]{9,}$/.test(values.phone.trim())) {
      errors.phone = 'Enter a valid phone number for verification.';
    }
  }

  if (step === 'review' && !values.accepted) {
    errors.accepted = 'Confirm that the information is accurate.';
  }

  return errors;
}

function Field({
  label,
  value,
  onChange,
  error,
  placeholder,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  placeholder: string;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-200">{label}</span>
      <input
        className={[
          'mt-2 min-h-12 w-full rounded-2xl border bg-slate-950/70 px-4 text-sm text-white outline-none transition duration-200 ease-out placeholder:text-slate-500 focus:ring-2',
          error ? 'border-rose-300/60 focus:ring-rose-400/30' : 'border-white/10 focus:border-violet-300 focus:ring-violet-400/30',
        ].join(' ')}
        type={type}
        value={value}
        placeholder={placeholder}
        aria-invalid={Boolean(error)}
        onChange={(event) => onChange(event.target.value)}
      />
      {error ? (
        <span className="mt-2 flex items-center gap-2 text-xs text-rose-200">
          <LockKeyhole className="h-3.5 w-3.5" />
          {error}
        </span>
      ) : null}
    </label>
  );
}

function ProgressIndicator({ currentIndex }: { currentIndex: number }) {
  return (
    <div aria-label="Onboarding progress" className="space-y-3">
      <div className="flex items-center justify-between">
        {steps.map((step, index) => {
          const complete = index < currentIndex;
          const active = index === currentIndex;
          return (
            <div key={step.id} className="flex flex-1 items-center">
              <div
                className={[
                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-xs font-semibold transition duration-200 ease-out',
                  complete
                    ? 'border-emerald-300 bg-emerald-400 text-slate-950'
                    : active
                      ? 'border-violet-300 bg-violet-500 text-white'
                      : 'border-white/10 bg-slate-900 text-slate-400',
                ].join(' ')}
              >
                {complete ? <Check className="h-4 w-4" /> : index + 1}
              </div>
              {index < steps.length - 1 ? (
                <div className={['h-px flex-1', index < currentIndex ? 'bg-emerald-300' : 'bg-white/10'].join(' ')} />
              ) : null}
            </div>
          );
        })}
      </div>
      <p className="text-sm text-slate-400">
        Step {currentIndex + 1} of {steps.length}: <span className="font-medium text-white">{steps[currentIndex].title}</span>
      </p>
    </div>
  );
}

export function OnboardingFlow() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [direction, setDirection] = useState<'forward' | 'back'>('forward');

  const currentStep = steps[currentIndex];
  const completion = useMemo(() => Math.round(((currentIndex + 1) / steps.length) * 100), [currentIndex]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  }

  function goNext(event?: FormEvent) {
    event?.preventDefault();
    const nextErrors = validateStep(currentStep.id, form);
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) return;
    if (currentIndex < steps.length - 1) {
      setDirection('forward');
      setCurrentIndex((index) => index + 1);
    }
  }

  function goBack() {
    if (currentIndex === 0) return;
    setDirection('back');
    setCurrentIndex((index) => index - 1);
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-6 text-slate-100 sm:px-6">
      <div className="mx-auto grid min-h-[calc(100vh-48px)] max-w-6xl gap-6 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
        <aside className="hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-violet-500 via-slate-900 to-cyan-500 p-8 shadow-2xl shadow-violet-950/30 lg:block">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
            <Sparkles className="h-4 w-4" />
            Trusted onboarding
          </div>
          <h1 className="mt-10 text-5xl font-semibold tracking-tight text-white">
            Join ZITO with a calmer, safer setup flow.
          </h1>
          <p className="mt-5 text-sm leading-6 text-white/78">
            Four guided steps keep identity, workspace context, verification, and review separate so users always know what is happening.
          </p>
          <div className="mt-10 grid grid-cols-3 gap-3">
            {[
              ['256-bit', 'secure'],
              ['4 steps', 'guided'],
              [`${completion}%`, 'done'],
            ].map(([value, label]) => (
              <div key={label} className="rounded-2xl bg-white/15 p-4 backdrop-blur">
                <p className="text-2xl font-semibold text-white">{value}</p>
                <p className="mt-1 text-xs text-white/70">{label}</p>
              </div>
            ))}
          </div>
        </aside>

        <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-slate-900/85 p-5 shadow-2xl shadow-black/30 sm:p-6">
          <ProgressIndicator currentIndex={currentIndex} />

          <form className="mt-8" onSubmit={goNext}>
            <div
              key={currentStep.id}
              className={[
                'min-h-[430px] transition duration-200 ease-out [animation:onboarding-slide_220ms_ease-out]',
                direction === 'forward' ? '' : '[animation-direction:reverse]',
              ].join(' ')}
            >
              <div className="mb-7">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-200">{currentStep.title}</p>
                <h2 className="mt-2 text-3xl font-semibold tracking-tight text-white">{currentStep.helper}</h2>
              </div>

              {currentStep.id === 'identity' ? (
                <div className="space-y-5">
                  <div className="grid gap-3 sm:grid-cols-3">
                    {[
                      { id: 'biometric', label: 'Biometric', icon: Fingerprint },
                      { id: 'google', label: 'Google', icon: Mail },
                      { id: 'email', label: 'GitHub', icon: GitBranch },
                    ].map((option) => {
                      const Icon = option.icon;
                      const active = form.loginMethod === option.id;
                      return (
                        <button
                          key={option.id}
                          type="button"
                          className={[
                            'flex min-h-20 flex-col items-center justify-center rounded-2xl border text-sm font-semibold transition duration-200 ease-out focus:outline-none focus:ring-2 focus:ring-violet-300',
                            active
                              ? 'border-violet-300 bg-violet-500 text-white shadow-lg shadow-violet-950/30'
                              : 'border-white/10 bg-white/[0.05] text-slate-200 hover:bg-white/[0.08]',
                          ].join(' ')}
                          onClick={() => update('loginMethod', option.id as FormState['loginMethod'])}
                        >
                          <Icon className="mb-2 h-5 w-5" />
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                  <Field label="Full name" value={form.fullName} placeholder="Vishal Golatkar" error={errors.fullName} onChange={(value) => update('fullName', value)} />
                  <Field label="Work email" type="email" value={form.email} placeholder="you@company.com" error={errors.email} onChange={(value) => update('email', value)} />
                </div>
              ) : null}

              {currentStep.id === 'profile' ? (
                <div className="space-y-5">
                  <Field label="Company or team" value={form.company} placeholder="ZITO Logistics" error={errors.company} onChange={(value) => update('company', value)} />
                  <label className="block">
                    <span className="text-sm font-medium text-slate-200">Primary role</span>
                    <select
                      className={[
                        'mt-2 min-h-12 w-full rounded-2xl border bg-slate-950/70 px-4 text-sm text-white outline-none transition duration-200 ease-out focus:ring-2',
                        errors.role ? 'border-rose-300/60 focus:ring-rose-400/30' : 'border-white/10 focus:border-violet-300 focus:ring-violet-400/30',
                      ].join(' ')}
                      value={form.role}
                      onChange={(event) => update('role', event.target.value)}
                      aria-invalid={Boolean(errors.role)}
                    >
                      <option value="">Select role</option>
                      <option value="Customer">Customer</option>
                      <option value="Transporter">Transporter</option>
                      <option value="Driver">Driver</option>
                      <option value="Warehouse partner">Warehouse partner</option>
                    </select>
                    {errors.role ? <span className="mt-2 block text-xs text-rose-200">{errors.role}</span> : null}
                  </label>
                  <Field label="Operating city" value={form.city} placeholder="Nairobi" error={errors.city} onChange={(value) => update('city', value)} />
                </div>
              ) : null}

              {currentStep.id === 'security' ? (
                <div className="space-y-5">
                  <div className="rounded-3xl border border-emerald-300/20 bg-emerald-400/10 p-5">
                    <div className="flex items-start gap-3">
                      <ShieldCheck className="mt-0.5 h-5 w-5 text-emerald-200" />
                      <div>
                        <p className="font-semibold text-white">Protected verification</p>
                        <p className="mt-2 text-sm leading-6 text-slate-300">
                          We use this number for OTP, fraud alerts, and account recovery. Production OTP rules still apply after this UX step.
                        </p>
                      </div>
                    </div>
                  </div>
                  <Field label="Phone number" value={form.phone} placeholder="+254 700 000 000" error={errors.phone} onChange={(value) => update('phone', value)} />
                </div>
              ) : null}

              {currentStep.id === 'review' ? (
                <div className="space-y-5">
                  <div className="grid gap-3">
                    {[
                      { label: 'Name', value: form.fullName || 'Not set', icon: UserRound },
                      { label: 'Workspace', value: form.company || 'Not set', icon: Building2 },
                      { label: 'City', value: form.city || 'Not set', icon: MapPin },
                      { label: 'Phone', value: form.phone || 'Not set', icon: Phone },
                    ].map((item) => {
                      const Icon = item.icon;
                      return (
                        <div key={item.label} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.05] p-4">
                          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-500/15 text-violet-100">
                            <Icon className="h-5 w-5" />
                          </span>
                          <div>
                            <p className="text-xs text-slate-400">{item.label}</p>
                            <p className="mt-1 text-sm font-semibold text-white">{item.value}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <label className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.05] p-4">
                    <input
                      type="checkbox"
                      className="mt-1 h-5 w-5 rounded border-white/20 bg-slate-950 text-violet-500 focus:ring-violet-400"
                      checked={form.accepted}
                      onChange={(event) => update('accepted', event.target.checked)}
                    />
                    <span className="text-sm leading-6 text-slate-300">
                      I confirm this information is accurate and understand that OTP and KYC verification are still required.
                      {errors.accepted ? <span className="mt-2 block text-xs text-rose-200">{errors.accepted}</span> : null}
                    </span>
                  </label>
                </div>
              ) : null}
            </div>

            <div className="mt-6 flex items-center justify-between gap-3">
              <button
                type="button"
                className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] px-4 text-sm font-semibold text-slate-200 transition duration-200 ease-out hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-40"
                disabled={currentIndex === 0}
                onClick={goBack}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </button>
              <button
                type="submit"
                className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-violet-500 px-5 text-sm font-semibold text-white shadow-lg shadow-violet-950/30 transition duration-200 ease-out hover:bg-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-300"
              >
                {currentIndex === steps.length - 1 ? (
                  <>
                    <BadgeCheck className="mr-2 h-4 w-4" />
                    Finish
                  </>
                ) : (
                  <>
                    Continue
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </button>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}
