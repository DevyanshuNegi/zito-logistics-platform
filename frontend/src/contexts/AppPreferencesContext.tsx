'use client';

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { api } from '@/lib/api';
import {
  APP_MESSAGES,
  DEFAULT_APP_CURRENCY,
  DEFAULT_APP_LOCALE,
  PREFERENCES_STORAGE_KEY,
  SUPPORTED_CURRENCY_OPTIONS,
  SUPPORTED_LANGUAGE_OPTIONS,
  type AppCurrency,
  type AppLocale,
} from '@/lib/i18n';
import { useAuthContext } from './AuthContext';

type PreferencePayload = {
  language: AppLocale;
  currency: AppCurrency;
};

type AppPreferencesContextValue = {
  locale: AppLocale;
  currency: AppCurrency;
  hydrated: boolean;
  setPreferences: (next: Partial<PreferencePayload>) => void;
};

const AppPreferencesContext = createContext<AppPreferencesContextValue | undefined>(
  undefined,
);

function readLocalPreferences() {
  if (typeof window === 'undefined') {
    return {
      language: DEFAULT_APP_LOCALE,
      currency: DEFAULT_APP_CURRENCY,
    };
  }

  const raw = window.localStorage.getItem(PREFERENCES_STORAGE_KEY);
  if (!raw) {
    return {
      language: DEFAULT_APP_LOCALE,
      currency: DEFAULT_APP_CURRENCY,
    };
  }

  try {
    const parsed = JSON.parse(raw) as Partial<PreferencePayload>;
    const language = SUPPORTED_LANGUAGE_OPTIONS.some(
      (option) => option.code === parsed.language,
    )
      ? (parsed.language as AppLocale)
      : DEFAULT_APP_LOCALE;
    const currency = SUPPORTED_CURRENCY_OPTIONS.some(
      (option) => option.code === parsed.currency,
    )
      ? (parsed.currency as AppCurrency)
      : DEFAULT_APP_CURRENCY;

    return { language, currency };
  } catch {
    return {
      language: DEFAULT_APP_LOCALE,
      currency: DEFAULT_APP_CURRENCY,
    };
  }
}

export function AppPreferencesProvider({ children }: { children: ReactNode }) {
  const { user, accessToken } = useAuthContext();
  const [locale, setLocale] = useState<AppLocale>(DEFAULT_APP_LOCALE);
  const [currency, setCurrency] = useState<AppCurrency>(DEFAULT_APP_CURRENCY);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const local = readLocalPreferences();
    setLocale(local.language);
    setCurrency(local.currency);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(
      PREFERENCES_STORAGE_KEY,
      JSON.stringify({
        language: locale,
        currency,
      }),
    );
    document.documentElement.lang = locale;
  }, [currency, hydrated, locale]);

  useEffect(() => {
    if (!hydrated || !user || !accessToken) {
      return;
    }

    void (async () => {
      try {
        const response = await api.get<{
          language?: AppLocale;
          currency?: AppCurrency;
        }>('/users/me/preferences', { retry: false });

        if (response.language) {
          setLocale(response.language);
        }
        if (response.currency) {
          setCurrency(response.currency);
        }
      } catch {
        // Keep local preferences when the remote preference payload is unavailable.
      }
    })();
  }, [accessToken, hydrated, user]);

  const value = useMemo<AppPreferencesContextValue>(
    () => ({
      locale,
      currency,
      hydrated,
      setPreferences: (next) => {
        if (next.language) {
          setLocale(next.language);
        }
        if (next.currency) {
          setCurrency(next.currency);
        }
      },
    }),
    [currency, hydrated, locale],
  );

  return (
    <AppPreferencesContext.Provider value={value}>
      <NextIntlClientProvider locale={locale} messages={APP_MESSAGES[locale]}>
        {children}
      </NextIntlClientProvider>
    </AppPreferencesContext.Provider>
  );
}

export function useAppPreferences() {
  const context = useContext(AppPreferencesContext);
  if (!context) {
    throw new Error('useAppPreferences must be used inside AppPreferencesProvider');
  }
  return context;
}
