'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import {
  CreditCard,
  Globe2,
  Headset,
  LogOut,
  MapPinned,
  PackageSearch,
  ShieldCheck,
  Truck,
  Wallet,
} from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { useAuth } from '@/hooks/useAuth';
import { ApiError, api } from '@/lib/api';
import {
  SUPPORTED_CURRENCY_OPTIONS,
  SUPPORTED_LANGUAGE_OPTIONS,
  type AppCurrency,
  type AppLocale,
} from '@/lib/i18n';
import { formatStatus } from '@/lib/format';
import { useAppPreferences } from '@/contexts/AppPreferencesContext';
import { getGuidePathForRole } from '@/lib/auth-portals';

type PreferencesResponse = {
  language: AppLocale;
  currency: AppCurrency;
};

export default function CustomerProfilePage() {
  const t = useTranslations('Profile');
  const router = useRouter();
  const { user, logout } = useAuth();
  const { locale, currency, setPreferences } = useAppPreferences();
  const [selectedLanguage, setSelectedLanguage] = useState<AppLocale>(locale);
  const [selectedCurrency, setSelectedCurrency] = useState<AppCurrency>(currency);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    setSelectedLanguage(locale);
    setSelectedCurrency(currency);
  }, [currency, locale]);

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await api.patch<PreferencesResponse>('/users/me/preferences', {
        language: selectedLanguage,
        currency: selectedCurrency,
      });
      setPreferences(response);
      setSuccess(t('saved'));
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : 'Unable to save language and currency preferences.',
      );
    } finally {
      setSaving(false);
    }
  }

  if (!user) {
    return <Spinner />;
  }

  return (
    <div className="space-y-6">
      {error ? (
        <Alert title="Profile preferences error" variant="danger">
          {error}
        </Alert>
      ) : null}

      {success ? (
        <Alert title="Profile preferences updated" variant="success">
          {success}
        </Alert>
      ) : null}

      <section className="overflow-hidden rounded-[34px] border border-white/80 bg-[linear-gradient(135deg,#e9f4ff_0%,#f5f9ff_48%,#ffffff_100%)] p-6 shadow-[0_22px_60px_rgba(15,23,42,0.08)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <p className="text-[11px] uppercase tracking-[0.32em] text-sky-700">Account</p>
            <h1 className="mt-3 text-3xl font-semibold text-slate-950">
              Keep your logistics identity, preferences, and support access in one place.
            </h1>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              This account surface is designed for quick settings, payment shortcuts, saved context, and clean logout handling.
            </p>
          </div>

          <div className="rounded-[26px] bg-[#0f2340] px-5 py-5 text-white">
            <p className="text-xs uppercase tracking-[0.24em] text-cyan-100/80">Signed in as</p>
            <p className="mt-2 text-xl font-semibold">
              {user.fullName ?? user.email ?? user.phone ?? user.id}
            </p>
            <p className="mt-1 text-sm text-slate-300">
              {user.companyName ?? user.email ?? user.phone ?? 'Customer account'}
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: 'Role',
            value: formatStatus(user.role),
            helper: 'Your current service-app identity.',
            tone: 'bg-white',
          },
          {
            label: 'Status',
            value: formatStatus(user.status ?? 'ACTIVE'),
            helper: 'Only active accounts can continue into booking and tracking.',
            tone: 'bg-[#eefbf4]',
          },
          {
            label: t('localeCard'),
            value: selectedLanguage.toUpperCase(),
            helper: 'Language used across the customer app.',
            tone: 'bg-[#eef6ff]',
          },
          {
            label: t('currencyCard'),
            value: selectedCurrency,
            helper: 'Display currency for quotes and commercial totals.',
            tone: 'bg-[#fff8e8]',
          },
        ].map((item) => (
          <div
            key={item.label}
            className={`rounded-[28px] border border-slate-200/90 ${item.tone} p-5 shadow-[0_18px_48px_rgba(15,23,42,0.06)]`}
          >
            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">{item.label}</p>
            <p className="mt-3 text-2xl font-semibold text-slate-950">{item.value}</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">{item.helper}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_.95fr]">
        <div className="rounded-[32px] border border-slate-200/90 bg-white/94 p-5 shadow-[0_18px_48px_rgba(15,23,42,0.06)]">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-sky-100 text-sky-700">
              <Globe2 className="h-6 w-6" />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.28em] text-slate-500">
                Preferences
              </p>
              <h2 className="mt-1 text-2xl font-semibold text-slate-950">{t('title')}</h2>
            </div>
          </div>

          <p className="mt-3 text-sm leading-6 text-slate-500">{t('description')}</p>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700">{t('languageLabel')}</span>
              <select
                className="w-full rounded-[22px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100"
                value={selectedLanguage}
                onChange={(event) => setSelectedLanguage(event.target.value as AppLocale)}
              >
                {SUPPORTED_LANGUAGE_OPTIONS.map((option) => (
                  <option key={option.code} value={option.code}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700">{t('currencyLabel')}</span>
              <select
                className="w-full rounded-[22px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100"
                value={selectedCurrency}
                onChange={(event) => setSelectedCurrency(event.target.value as AppCurrency)}
              >
                {SUPPORTED_CURRENCY_OPTIONS.map((option) => (
                  <option key={option.code} value={option.code}>
                    {option.code} · {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-6">
            <Button
              disabled={saving}
              className="rounded-[16px] bg-[#1b3f72] px-5 py-3 text-white shadow-none hover:bg-[#163561]"
              onClick={() => void handleSave()}
            >
              {saving ? t('saving') : t('save')}
            </Button>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-[32px] border border-slate-200/90 bg-white/94 p-5 shadow-[0_18px_48px_rgba(15,23,42,0.06)]">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-emerald-100 text-emerald-700">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.28em] text-slate-500">Identity</p>
                <h2 className="mt-1 text-2xl font-semibold text-slate-950">
                  Account details at a glance
                </h2>
              </div>
            </div>

            <div className="mt-5 grid gap-3">
              {[
                { label: t('email'), value: user.email ?? 'Not available' },
                { label: t('phone'), value: user.phone ?? 'Not available' },
                { label: 'Company', value: user.companyName ?? 'Not linked' },
                { label: 'Access path', value: 'Zito Logistics service app' },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4"
                >
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-500">{item.label}</p>
                  <p className="mt-2 text-sm font-medium text-slate-900">{item.value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[32px] border border-slate-200/90 bg-white/94 p-5 shadow-[0_18px_48px_rgba(15,23,42,0.06)]">
            <p className="text-[11px] uppercase tracking-[0.28em] text-slate-500">Quick access</p>
            <h2 className="mt-1 text-2xl font-semibold text-slate-950">
              Jump back into the customer tools you use most
            </h2>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {[
                {
                  href: '/customer/bookings',
                  label: 'Bookings',
                  helper: 'Booking feed and delivery history',
                  icon: PackageSearch,
                },
                {
                  href: '/customer/payments',
                  label: 'Payments',
                  helper: 'Wallet, invoices, and payment attempts',
                  icon: Wallet,
                },
                {
                  href: '/customer/fleet',
                  label: 'Own fleet',
                  helper: 'Manage your vehicles and customer-owned drivers',
                  icon: Truck,
                },
                {
                  href: '/customer/support',
                  label: 'Support',
                  helper: 'Raise and track support tickets',
                  icon: Headset,
                },
                {
                  href: getGuidePathForRole(user.role),
                  label: 'User guide',
                  helper: 'Role-based walkthrough and testing guide',
                  icon: MapPinned,
                },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4 transition hover:border-sky-200 hover:bg-white"
                  >
                    <div className="flex h-11 w-11 items-center justify-center rounded-[16px] bg-[#eef6ff] text-[#1b3f72]">
                      <Icon className="h-5 w-5" />
                    </div>
                    <p className="mt-4 text-base font-semibold text-slate-950">{item.label}</p>
                    <p className="mt-1 text-sm leading-6 text-slate-500">{item.helper}</p>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[32px] border border-rose-200 bg-rose-50/70 p-5 shadow-[0_18px_48px_rgba(15,23,42,0.04)]">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.28em] text-rose-500">Session</p>
            <h2 className="mt-1 text-2xl font-semibold text-slate-950">Log out from Account</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Keep logout inside the account surface so the main customer navigation stays focused on logistics actions.
            </p>
          </div>
          <Button
            className="rounded-[16px] bg-rose-500 px-5 py-3 text-white shadow-none hover:bg-rose-600"
            variant="danger"
            onClick={() => {
              logout();
              router.push('/login');
            }}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Log out
          </Button>
        </div>
      </section>
    </div>
  );
}
