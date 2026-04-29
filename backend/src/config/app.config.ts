export const DEFAULT_LANGUAGE = 'en' as const;
export const DEFAULT_CURRENCY = 'KES' as const;

export const SUPPORTED_LANGUAGE_CODES = ['en', 'sw', 'fr', 'am'] as const;
export type SupportedLanguageCode = (typeof SUPPORTED_LANGUAGE_CODES)[number];

export const SUPPORTED_CURRENCY_CODES = [
  'KES',
  'UGX',
  'TZS',
  'RWF',
  'NGN',
  'GHS',
  'ZAR',
] as const;
export type SupportedCurrencyCode = (typeof SUPPORTED_CURRENCY_CODES)[number];
export const SUPPORTED_COUNTRY_CODES = ['KE', 'UG', 'TZ', 'RW'] as const;
export type SupportedCountryCode = (typeof SUPPORTED_COUNTRY_CODES)[number];

function envRate(name: string, fallback: number) {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const SUPPORTED_LANGUAGES: Record<
  SupportedLanguageCode,
  { code: SupportedLanguageCode; label: string; region: string }
> = {
  en: { code: 'en', label: 'English', region: 'Kenya' },
  sw: { code: 'sw', label: 'Kiswahili', region: 'East Africa' },
  fr: { code: 'fr', label: 'French', region: 'Francophone Africa' },
  am: { code: 'am', label: 'Amharic', region: 'Ethiopia' },
};

export const SUPPORTED_CURRENCIES: Record<
  SupportedCurrencyCode,
  {
    code: SupportedCurrencyCode;
    label: string;
    symbol: string;
    country: string;
    rateFromKes: number;
  }
> = {
  KES: {
    code: 'KES',
    label: 'Kenyan Shilling',
    symbol: 'KSh',
    country: 'Kenya',
    rateFromKes: 1,
  },
  UGX: {
    code: 'UGX',
    label: 'Ugandan Shilling',
    symbol: 'USh',
    country: 'Uganda',
    rateFromKes: envRate('FX_KES_TO_UGX', 28.5),
  },
  TZS: {
    code: 'TZS',
    label: 'Tanzanian Shilling',
    symbol: 'TSh',
    country: 'Tanzania',
    rateFromKes: envRate('FX_KES_TO_TZS', 19.8),
  },
  RWF: {
    code: 'RWF',
    label: 'Rwandan Franc',
    symbol: 'RF',
    country: 'Rwanda',
    rateFromKes: envRate('FX_KES_TO_RWF', 9.35),
  },
  NGN: {
    code: 'NGN',
    label: 'Nigerian Naira',
    symbol: 'N',
    country: 'Nigeria',
    rateFromKes: envRate('FX_KES_TO_NGN', 11.7),
  },
  GHS: {
    code: 'GHS',
    label: 'Ghanaian Cedi',
    symbol: 'GHs',
    country: 'Ghana',
    rateFromKes: envRate('FX_KES_TO_GHS', 0.12),
  },
  ZAR: {
    code: 'ZAR',
    label: 'South African Rand',
    symbol: 'R',
    country: 'South Africa',
    rateFromKes: envRate('FX_KES_TO_ZAR', 0.13),
  },
};

export const COUNTRY_CONFIGS: Record<
  SupportedCountryCode,
  {
    code: SupportedCountryCode;
    label: string;
    currency: SupportedCurrencyCode;
    vatRate: number;
    rateMultiplier: number;
    crossBorderClearanceFeePct: number;
  }
> = {
  KE: {
    code: 'KE',
    label: 'Kenya',
    currency: 'KES',
    vatRate: envRate('COUNTRY_KE_VAT_RATE', 16),
    rateMultiplier: envRate('COUNTRY_KE_RATE_MULTIPLIER', 1),
    crossBorderClearanceFeePct: envRate('COUNTRY_KE_CLEARANCE_FEE_PCT', 0),
  },
  UG: {
    code: 'UG',
    label: 'Uganda',
    currency: 'UGX',
    vatRate: envRate('COUNTRY_UG_VAT_RATE', 18),
    rateMultiplier: envRate('COUNTRY_UG_RATE_MULTIPLIER', 1.08),
    crossBorderClearanceFeePct: envRate('COUNTRY_UG_CLEARANCE_FEE_PCT', 3),
  },
  TZ: {
    code: 'TZ',
    label: 'Tanzania',
    currency: 'TZS',
    vatRate: envRate('COUNTRY_TZ_VAT_RATE', 18),
    rateMultiplier: envRate('COUNTRY_TZ_RATE_MULTIPLIER', 1.11),
    crossBorderClearanceFeePct: envRate('COUNTRY_TZ_CLEARANCE_FEE_PCT', 3),
  },
  RW: {
    code: 'RW',
    label: 'Rwanda',
    currency: 'RWF',
    vatRate: envRate('COUNTRY_RW_VAT_RATE', 18),
    rateMultiplier: envRate('COUNTRY_RW_RATE_MULTIPLIER', 1.06),
    crossBorderClearanceFeePct: envRate('COUNTRY_RW_CLEARANCE_FEE_PCT', 3),
  },
};
