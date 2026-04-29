'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { SurfaceCard } from '@/components/layout/SurfaceCard';
import { StatCard } from '@/components/layout/StatCard';
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

type PreferencesResponse = {
  language: AppLocale;
  currency: AppCurrency;
};

export default function CustomerProfilePage() {
  const t = useTranslations('Profile');
  const { user } = useAuth();
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
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label={t('localeCard')} value={selectedLanguage.toUpperCase()} helper="Portal translation preference." tone="info" />
        <StatCard label={t('currencyCard')} value={selectedCurrency} helper="Commercial display currency for quotes." tone="success" />
        <StatCard label={t('profileCard')} value={user.fullName ?? user.email ?? user.phone ?? user.id} helper="Authenticated customer identity." />
      </div>

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

      <SurfaceCard title={t('title')} description={t('description')}>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-200">{t('languageLabel')}</span>
            <select
              className="w-full rounded-2xl border border-slate-700/70 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 focus:border-sky-400/70 focus:outline-none"
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
            <span className="text-sm font-medium text-slate-200">{t('currencyLabel')}</span>
            <select
              className="w-full rounded-2xl border border-slate-700/70 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 focus:border-sky-400/70 focus:outline-none"
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
          <Button disabled={saving} onClick={() => void handleSave()}>
            {saving ? t('saving') : t('save')}
          </Button>
        </div>
      </SurfaceCard>

      <SurfaceCard title={t('accountTitle')} description={t('accountDescription')}>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-3xl border border-slate-700/40 bg-slate-900/55 p-4">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">{t('role')}</p>
            <p className="mt-3 text-lg font-semibold text-white">{formatStatus(user.role)}</p>
          </div>
          <div className="rounded-3xl border border-slate-700/40 bg-slate-900/55 p-4">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">{t('status')}</p>
            <p className="mt-3 text-lg font-semibold text-white">{formatStatus(user.status ?? 'ACTIVE')}</p>
          </div>
          <div className="rounded-3xl border border-slate-700/40 bg-slate-900/55 p-4">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">{t('email')}</p>
            <p className="mt-3 text-lg font-semibold text-white">{user.email ?? 'Not available'}</p>
          </div>
          <div className="rounded-3xl border border-slate-700/40 bg-slate-900/55 p-4">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">{t('phone')}</p>
            <p className="mt-3 text-lg font-semibold text-white">{user.phone ?? 'Not available'}</p>
          </div>
        </div>
      </SurfaceCard>
    </div>
  );
}
