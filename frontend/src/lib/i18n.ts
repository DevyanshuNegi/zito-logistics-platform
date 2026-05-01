export const PREFERENCES_STORAGE_KEY = 'zito.preferences';

export const SUPPORTED_LANGUAGE_OPTIONS = [
  { code: 'en', label: 'English' },
  { code: 'sw', label: 'Kiswahili' },
  { code: 'fr', label: 'French' },
  { code: 'am', label: 'Amharic' },
] as const;

export const SUPPORTED_CURRENCY_OPTIONS = [
  { code: 'KES', label: 'Kenyan Shilling' },
  { code: 'UGX', label: 'Ugandan Shilling' },
  { code: 'TZS', label: 'Tanzanian Shilling' },
  { code: 'NGN', label: 'Nigerian Naira' },
  { code: 'GHS', label: 'Ghanaian Cedi' },
  { code: 'ZAR', label: 'South African Rand' },
] as const;

export type AppLocale = (typeof SUPPORTED_LANGUAGE_OPTIONS)[number]['code'];
export type AppCurrency = (typeof SUPPORTED_CURRENCY_OPTIONS)[number]['code'];

export const DEFAULT_APP_LOCALE: AppLocale = 'en';
export const DEFAULT_APP_CURRENCY: AppCurrency = 'KES';
export const APP_TIME_ZONE = 'Africa/Nairobi';

export const LOCALE_FORMAT_MAP: Record<AppLocale, string> = {
  en: 'en-KE',
  sw: 'sw-KE',
  fr: 'fr-FR',
  am: 'am-ET',
};

export const APP_MESSAGES = {
  en: {
    Shell: {
      operationsPortal: 'Operations Portal',
      home: 'Home',
      logOut: 'Log Out',
      signedIn: 'Signed in',
      activeSession: 'Active session',
    },
    Profile: {
      title: 'Language and currency',
      description:
        'Set your preferred language and commercial display currency for the customer portal.',
      languageLabel: 'Preferred language',
      currencyLabel: 'Preferred currency',
      save: 'Save preferences',
      saving: 'Saving...',
      saved: 'Preferences updated successfully.',
      accountTitle: 'Account snapshot',
      accountDescription: 'Live profile details from the authenticated customer session.',
      role: 'Role',
      status: 'Status',
      email: 'Email',
      phone: 'Phone',
      localeCard: 'Language',
      currencyCard: 'Currency',
      profileCard: 'Profile',
    },
  },
  sw: {
    Shell: {
      operationsPortal: 'Kituo cha Uendeshaji',
      home: 'Nyumbani',
      logOut: 'Toka',
      signedIn: 'Umeingia',
      activeSession: 'Kikao kinaendelea',
    },
    Profile: {
      title: 'Lugha na sarafu',
      description:
        'Weka lugha na sarafu unayopendelea kwa mwonekano wa tovuti ya mteja.',
      languageLabel: 'Lugha unayopendelea',
      currencyLabel: 'Sarafu unayopendelea',
      save: 'Hifadhi mapendeleo',
      saving: 'Inahifadhi...',
      saved: 'Mapendeleo yamehifadhiwa.',
      accountTitle: 'Muhtasari wa akaunti',
      accountDescription: 'Maelezo ya sasa ya profaili kutoka kwa kikao cha mteja.',
      role: 'Wajibu',
      status: 'Hali',
      email: 'Barua pepe',
      phone: 'Simu',
      localeCard: 'Lugha',
      currencyCard: 'Sarafu',
      profileCard: 'Profaili',
    },
  },
  fr: {
    Shell: {
      operationsPortal: 'Portail des Operations',
      home: 'Accueil',
      logOut: 'Se deconnecter',
      signedIn: 'Connecte',
      activeSession: 'Session active',
    },
    Profile: {
      title: 'Langue et devise',
      description:
        'Definissez votre langue preferee et la devise d affichage commerciale du portail client.',
      languageLabel: 'Langue preferee',
      currencyLabel: 'Devise preferee',
      save: 'Enregistrer les preferences',
      saving: 'Enregistrement...',
      saved: 'Preferences mises a jour avec succes.',
      accountTitle: 'Resume du compte',
      accountDescription: 'Details du profil en direct depuis la session client authentifiee.',
      role: 'Role',
      status: 'Statut',
      email: 'E-mail',
      phone: 'Telephone',
      localeCard: 'Langue',
      currencyCard: 'Devise',
      profileCard: 'Profil',
    },
  },
  am: {
    Shell: {
      operationsPortal: 'የስራ አስተዳደር ፖርታል',
      home: 'መነሻ',
      logOut: 'ውጣ',
      signedIn: 'ገብተዋል',
      activeSession: 'ንቁ ክፍለ ጊዜ',
    },
    Profile: {
      title: 'ቋንቋ እና ምንዛሬ',
      description:
        'ለደንበኛ ፖርታሉ የሚፈልጉትን ቋንቋ እና የንግድ ምንዛሬ ያስቀምጡ።',
      languageLabel: 'የሚፈልጉት ቋንቋ',
      currencyLabel: 'የሚፈልጉት ምንዛሬ',
      save: 'ምርጫዎችን አስቀምጥ',
      saving: 'በማስቀመጥ ላይ...',
      saved: 'ምርጫዎቹ ተዘምነዋል።',
      accountTitle: 'የመለያ ማጠቃለያ',
      accountDescription: 'ከተረጋገጠው የደንበኛ ክፍለ ጊዜ የሚመጡ የመገለጫ ዝርዝሮች።',
      role: 'ሚና',
      status: 'ሁኔታ',
      email: 'ኢሜይል',
      phone: 'ስልክ',
      localeCard: 'ቋንቋ',
      currencyCard: 'ምንዛሬ',
      profileCard: 'መገለጫ',
    },
  },
} as const;
