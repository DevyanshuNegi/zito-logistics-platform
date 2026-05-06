export type CountryCodeOption = {
  isoCode: string;
  name: string;
  dialCode: string;
  keywords?: string[];
};

export const DEFAULT_COUNTRY_ISO_CODE = 'KE';

const COUNTRY_CODE_DATA: CountryCodeOption[] = [
  { isoCode: 'AF', name: 'Afghanistan', dialCode: '+93' },
  { isoCode: 'AL', name: 'Albania', dialCode: '+355' },
  { isoCode: 'DZ', name: 'Algeria', dialCode: '+213' },
  { isoCode: 'AD', name: 'Andorra', dialCode: '+376' },
  { isoCode: 'AO', name: 'Angola', dialCode: '+244' },
  { isoCode: 'AG', name: 'Antigua and Barbuda', dialCode: '+1' },
  { isoCode: 'AR', name: 'Argentina', dialCode: '+54' },
  { isoCode: 'AM', name: 'Armenia', dialCode: '+374' },
  { isoCode: 'AU', name: 'Australia', dialCode: '+61' },
  { isoCode: 'AT', name: 'Austria', dialCode: '+43' },
  { isoCode: 'AZ', name: 'Azerbaijan', dialCode: '+994' },
  { isoCode: 'BS', name: 'Bahamas', dialCode: '+1' },
  { isoCode: 'BH', name: 'Bahrain', dialCode: '+973' },
  { isoCode: 'BD', name: 'Bangladesh', dialCode: '+880' },
  { isoCode: 'BB', name: 'Barbados', dialCode: '+1' },
  { isoCode: 'BY', name: 'Belarus', dialCode: '+375' },
  { isoCode: 'BE', name: 'Belgium', dialCode: '+32' },
  { isoCode: 'BZ', name: 'Belize', dialCode: '+501' },
  { isoCode: 'BJ', name: 'Benin', dialCode: '+229' },
  { isoCode: 'BT', name: 'Bhutan', dialCode: '+975' },
  { isoCode: 'BO', name: 'Bolivia', dialCode: '+591' },
  { isoCode: 'BA', name: 'Bosnia and Herzegovina', dialCode: '+387' },
  { isoCode: 'BW', name: 'Botswana', dialCode: '+267' },
  { isoCode: 'BR', name: 'Brazil', dialCode: '+55' },
  { isoCode: 'BN', name: 'Brunei', dialCode: '+673', keywords: ['brunei darussalam'] },
  { isoCode: 'BG', name: 'Bulgaria', dialCode: '+359' },
  { isoCode: 'BF', name: 'Burkina Faso', dialCode: '+226' },
  { isoCode: 'BI', name: 'Burundi', dialCode: '+257' },
  { isoCode: 'CV', name: 'Cabo Verde', dialCode: '+238', keywords: ['cape verde'] },
  { isoCode: 'KH', name: 'Cambodia', dialCode: '+855' },
  { isoCode: 'CM', name: 'Cameroon', dialCode: '+237' },
  { isoCode: 'CA', name: 'Canada', dialCode: '+1' },
  { isoCode: 'CF', name: 'Central African Republic', dialCode: '+236', keywords: ['car'] },
  { isoCode: 'TD', name: 'Chad', dialCode: '+235' },
  { isoCode: 'CL', name: 'Chile', dialCode: '+56' },
  { isoCode: 'CN', name: 'China', dialCode: '+86', keywords: ['prc'] },
  { isoCode: 'CO', name: 'Colombia', dialCode: '+57' },
  { isoCode: 'KM', name: 'Comoros', dialCode: '+269' },
  { isoCode: 'CG', name: 'Congo', dialCode: '+242', keywords: ['republic of the congo', 'congo brazzaville'] },
  { isoCode: 'CD', name: 'Congo (DRC)', dialCode: '+243', keywords: ['democratic republic of the congo', 'dr congo', 'drc', 'congo kinshasa'] },
  { isoCode: 'CR', name: 'Costa Rica', dialCode: '+506' },
  { isoCode: 'CI', name: "Cote d'Ivoire", dialCode: '+225', keywords: ['ivory coast', 'cote divoire'] },
  { isoCode: 'HR', name: 'Croatia', dialCode: '+385' },
  { isoCode: 'CU', name: 'Cuba', dialCode: '+53' },
  { isoCode: 'CY', name: 'Cyprus', dialCode: '+357' },
  { isoCode: 'CZ', name: 'Czechia', dialCode: '+420', keywords: ['czech republic'] },
  { isoCode: 'DK', name: 'Denmark', dialCode: '+45' },
  { isoCode: 'DJ', name: 'Djibouti', dialCode: '+253' },
  { isoCode: 'DM', name: 'Dominica', dialCode: '+1' },
  { isoCode: 'DO', name: 'Dominican Republic', dialCode: '+1' },
  { isoCode: 'EC', name: 'Ecuador', dialCode: '+593' },
  { isoCode: 'EG', name: 'Egypt', dialCode: '+20' },
  { isoCode: 'SV', name: 'El Salvador', dialCode: '+503' },
  { isoCode: 'GQ', name: 'Equatorial Guinea', dialCode: '+240' },
  { isoCode: 'ER', name: 'Eritrea', dialCode: '+291' },
  { isoCode: 'EE', name: 'Estonia', dialCode: '+372' },
  { isoCode: 'SZ', name: 'Eswatini', dialCode: '+268', keywords: ['swaziland'] },
  { isoCode: 'ET', name: 'Ethiopia', dialCode: '+251' },
  { isoCode: 'FJ', name: 'Fiji', dialCode: '+679' },
  { isoCode: 'FI', name: 'Finland', dialCode: '+358' },
  { isoCode: 'FR', name: 'France', dialCode: '+33' },
  { isoCode: 'GA', name: 'Gabon', dialCode: '+241' },
  { isoCode: 'GM', name: 'Gambia', dialCode: '+220' },
  { isoCode: 'GE', name: 'Georgia', dialCode: '+995' },
  { isoCode: 'DE', name: 'Germany', dialCode: '+49' },
  { isoCode: 'GH', name: 'Ghana', dialCode: '+233' },
  { isoCode: 'GR', name: 'Greece', dialCode: '+30' },
  { isoCode: 'GD', name: 'Grenada', dialCode: '+1' },
  { isoCode: 'GT', name: 'Guatemala', dialCode: '+502' },
  { isoCode: 'GN', name: 'Guinea', dialCode: '+224' },
  { isoCode: 'GW', name: 'Guinea-Bissau', dialCode: '+245' },
  { isoCode: 'GY', name: 'Guyana', dialCode: '+592' },
  { isoCode: 'HT', name: 'Haiti', dialCode: '+509' },
  { isoCode: 'HN', name: 'Honduras', dialCode: '+504' },
  { isoCode: 'HU', name: 'Hungary', dialCode: '+36' },
  { isoCode: 'IS', name: 'Iceland', dialCode: '+354' },
  { isoCode: 'IN', name: 'India', dialCode: '+91' },
  { isoCode: 'ID', name: 'Indonesia', dialCode: '+62' },
  { isoCode: 'IR', name: 'Iran', dialCode: '+98' },
  { isoCode: 'IQ', name: 'Iraq', dialCode: '+964' },
  { isoCode: 'IE', name: 'Ireland', dialCode: '+353' },
  { isoCode: 'IL', name: 'Israel', dialCode: '+972' },
  { isoCode: 'IT', name: 'Italy', dialCode: '+39' },
  { isoCode: 'JM', name: 'Jamaica', dialCode: '+1' },
  { isoCode: 'JP', name: 'Japan', dialCode: '+81' },
  { isoCode: 'JO', name: 'Jordan', dialCode: '+962' },
  { isoCode: 'KZ', name: 'Kazakhstan', dialCode: '+7' },
  { isoCode: 'KE', name: 'Kenya', dialCode: '+254' },
  { isoCode: 'KI', name: 'Kiribati', dialCode: '+686' },
  { isoCode: 'KP', name: 'North Korea', dialCode: '+850', keywords: ['dprk', 'korea dpr', 'democratic peoples republic of korea'] },
  { isoCode: 'KR', name: 'South Korea', dialCode: '+82', keywords: ['republic of korea', 'korea republic'] },
  { isoCode: 'KW', name: 'Kuwait', dialCode: '+965' },
  { isoCode: 'KG', name: 'Kyrgyzstan', dialCode: '+996' },
  { isoCode: 'LA', name: 'Laos', dialCode: '+856', keywords: ['lao', 'lao pdr'] },
  { isoCode: 'LV', name: 'Latvia', dialCode: '+371' },
  { isoCode: 'LB', name: 'Lebanon', dialCode: '+961' },
  { isoCode: 'LS', name: 'Lesotho', dialCode: '+266' },
  { isoCode: 'LR', name: 'Liberia', dialCode: '+231' },
  { isoCode: 'LY', name: 'Libya', dialCode: '+218' },
  { isoCode: 'LI', name: 'Liechtenstein', dialCode: '+423' },
  { isoCode: 'LT', name: 'Lithuania', dialCode: '+370' },
  { isoCode: 'LU', name: 'Luxembourg', dialCode: '+352' },
  { isoCode: 'MG', name: 'Madagascar', dialCode: '+261' },
  { isoCode: 'MW', name: 'Malawi', dialCode: '+265' },
  { isoCode: 'MY', name: 'Malaysia', dialCode: '+60' },
  { isoCode: 'MV', name: 'Maldives', dialCode: '+960' },
  { isoCode: 'ML', name: 'Mali', dialCode: '+223' },
  { isoCode: 'MT', name: 'Malta', dialCode: '+356' },
  { isoCode: 'MH', name: 'Marshall Islands', dialCode: '+692' },
  { isoCode: 'MR', name: 'Mauritania', dialCode: '+222' },
  { isoCode: 'MU', name: 'Mauritius', dialCode: '+230' },
  { isoCode: 'MX', name: 'Mexico', dialCode: '+52' },
  { isoCode: 'FM', name: 'Micronesia', dialCode: '+691', keywords: ['federated states of micronesia'] },
  { isoCode: 'MD', name: 'Moldova', dialCode: '+373', keywords: ['republic of moldova'] },
  { isoCode: 'MC', name: 'Monaco', dialCode: '+377' },
  { isoCode: 'MN', name: 'Mongolia', dialCode: '+976' },
  { isoCode: 'ME', name: 'Montenegro', dialCode: '+382' },
  { isoCode: 'MA', name: 'Morocco', dialCode: '+212' },
  { isoCode: 'MZ', name: 'Mozambique', dialCode: '+258' },
  { isoCode: 'MM', name: 'Myanmar', dialCode: '+95', keywords: ['burma'] },
  { isoCode: 'NA', name: 'Namibia', dialCode: '+264' },
  { isoCode: 'NR', name: 'Nauru', dialCode: '+674' },
  { isoCode: 'NP', name: 'Nepal', dialCode: '+977' },
  { isoCode: 'NL', name: 'Netherlands', dialCode: '+31', keywords: ['holland'] },
  { isoCode: 'NZ', name: 'New Zealand', dialCode: '+64' },
  { isoCode: 'NI', name: 'Nicaragua', dialCode: '+505' },
  { isoCode: 'NE', name: 'Niger', dialCode: '+227' },
  { isoCode: 'NG', name: 'Nigeria', dialCode: '+234' },
  { isoCode: 'MK', name: 'North Macedonia', dialCode: '+389', keywords: ['macedonia'] },
  { isoCode: 'NO', name: 'Norway', dialCode: '+47' },
  { isoCode: 'OM', name: 'Oman', dialCode: '+968' },
  { isoCode: 'PK', name: 'Pakistan', dialCode: '+92' },
  { isoCode: 'PW', name: 'Palau', dialCode: '+680' },
  { isoCode: 'PS', name: 'Palestine', dialCode: '+970', keywords: ['state of palestine'] },
  { isoCode: 'PA', name: 'Panama', dialCode: '+507' },
  { isoCode: 'PG', name: 'Papua New Guinea', dialCode: '+675' },
  { isoCode: 'PY', name: 'Paraguay', dialCode: '+595' },
  { isoCode: 'PE', name: 'Peru', dialCode: '+51' },
  { isoCode: 'PH', name: 'Philippines', dialCode: '+63' },
  { isoCode: 'PL', name: 'Poland', dialCode: '+48' },
  { isoCode: 'PT', name: 'Portugal', dialCode: '+351' },
  { isoCode: 'QA', name: 'Qatar', dialCode: '+974' },
  { isoCode: 'RO', name: 'Romania', dialCode: '+40' },
  { isoCode: 'RU', name: 'Russia', dialCode: '+7', keywords: ['russian federation'] },
  { isoCode: 'RW', name: 'Rwanda', dialCode: '+250' },
  { isoCode: 'KN', name: 'Saint Kitts and Nevis', dialCode: '+1' },
  { isoCode: 'LC', name: 'Saint Lucia', dialCode: '+1' },
  { isoCode: 'VC', name: 'Saint Vincent and the Grenadines', dialCode: '+1' },
  { isoCode: 'WS', name: 'Samoa', dialCode: '+685' },
  { isoCode: 'SM', name: 'San Marino', dialCode: '+378' },
  { isoCode: 'ST', name: 'Sao Tome and Principe', dialCode: '+239' },
  { isoCode: 'SA', name: 'Saudi Arabia', dialCode: '+966' },
  { isoCode: 'SN', name: 'Senegal', dialCode: '+221' },
  { isoCode: 'RS', name: 'Serbia', dialCode: '+381' },
  { isoCode: 'SC', name: 'Seychelles', dialCode: '+248' },
  { isoCode: 'SL', name: 'Sierra Leone', dialCode: '+232' },
  { isoCode: 'SG', name: 'Singapore', dialCode: '+65' },
  { isoCode: 'SK', name: 'Slovakia', dialCode: '+421' },
  { isoCode: 'SI', name: 'Slovenia', dialCode: '+386' },
  { isoCode: 'SB', name: 'Solomon Islands', dialCode: '+677' },
  { isoCode: 'SO', name: 'Somalia', dialCode: '+252' },
  { isoCode: 'ZA', name: 'South Africa', dialCode: '+27' },
  { isoCode: 'SS', name: 'South Sudan', dialCode: '+211' },
  { isoCode: 'ES', name: 'Spain', dialCode: '+34' },
  { isoCode: 'LK', name: 'Sri Lanka', dialCode: '+94' },
  { isoCode: 'SD', name: 'Sudan', dialCode: '+249' },
  { isoCode: 'SR', name: 'Suriname', dialCode: '+597' },
  { isoCode: 'SE', name: 'Sweden', dialCode: '+46' },
  { isoCode: 'CH', name: 'Switzerland', dialCode: '+41' },
  { isoCode: 'SY', name: 'Syria', dialCode: '+963', keywords: ['syrian arab republic'] },
  { isoCode: 'TW', name: 'Taiwan', dialCode: '+886' },
  { isoCode: 'TJ', name: 'Tajikistan', dialCode: '+992' },
  { isoCode: 'TZ', name: 'Tanzania', dialCode: '+255', keywords: ['united republic of tanzania'] },
  { isoCode: 'TH', name: 'Thailand', dialCode: '+66' },
  { isoCode: 'TL', name: 'Timor-Leste', dialCode: '+670', keywords: ['east timor'] },
  { isoCode: 'TG', name: 'Togo', dialCode: '+228' },
  { isoCode: 'TO', name: 'Tonga', dialCode: '+676' },
  { isoCode: 'TT', name: 'Trinidad and Tobago', dialCode: '+1' },
  { isoCode: 'TN', name: 'Tunisia', dialCode: '+216' },
  { isoCode: 'TR', name: 'Turkey', dialCode: '+90', keywords: ['turkiye'] },
  { isoCode: 'TM', name: 'Turkmenistan', dialCode: '+993' },
  { isoCode: 'TV', name: 'Tuvalu', dialCode: '+688' },
  { isoCode: 'UG', name: 'Uganda', dialCode: '+256' },
  { isoCode: 'UA', name: 'Ukraine', dialCode: '+380' },
  { isoCode: 'AE', name: 'United Arab Emirates', dialCode: '+971', keywords: ['uae', 'emirates'] },
  { isoCode: 'GB', name: 'United Kingdom', dialCode: '+44', keywords: ['uk', 'great britain', 'britain', 'england'] },
  { isoCode: 'US', name: 'United States', dialCode: '+1', keywords: ['usa', 'us', 'america', 'united states of america'] },
  { isoCode: 'UY', name: 'Uruguay', dialCode: '+598' },
  { isoCode: 'UZ', name: 'Uzbekistan', dialCode: '+998' },
  { isoCode: 'VU', name: 'Vanuatu', dialCode: '+678' },
  { isoCode: 'VA', name: 'Vatican City', dialCode: '+379', keywords: ['holy see'] },
  { isoCode: 'VE', name: 'Venezuela', dialCode: '+58' },
  { isoCode: 'VN', name: 'Vietnam', dialCode: '+84' },
  { isoCode: 'YE', name: 'Yemen', dialCode: '+967' },
  { isoCode: 'ZM', name: 'Zambia', dialCode: '+260' },
  { isoCode: 'ZW', name: 'Zimbabwe', dialCode: '+263' },
];

const collator = new Intl.Collator('en', { sensitivity: 'base' });

const normalizeDialCode = (dialCode: string) => {
  const digits = dialCode.replace(/\D/g, '');
  return digits ? `+${digits}` : '+';
};

const normalizeIsoCode = (isoCode: string) => isoCode.trim().toUpperCase();

const DEFAULT_COUNTRY_BY_DIAL_CODE: Record<string, string> = {
  '+1': 'US',
  '+7': 'RU',
};

export const COUNTRY_CODE_OPTIONS = COUNTRY_CODE_DATA.slice().sort((left, right) => {
  const nameComparison = collator.compare(left.name, right.name);
  return nameComparison || collator.compare(left.isoCode, right.isoCode);
});

const countryByIsoCode = new Map(
  COUNTRY_CODE_OPTIONS.map((option) => [normalizeIsoCode(option.isoCode), option]),
);

export function findCountryCodeOptionByIsoCode(isoCode?: string | null) {
  if (!isoCode) {
    return null;
  }

  return countryByIsoCode.get(normalizeIsoCode(isoCode)) ?? null;
}

export function findCountryCodeOptionByDialCode(dialCode?: string | null) {
  if (!dialCode) {
    return null;
  }

  const normalizedDialCode = normalizeDialCode(dialCode);
  const preferredIsoCode = DEFAULT_COUNTRY_BY_DIAL_CODE[normalizedDialCode];
  if (preferredIsoCode) {
    const preferredOption = findCountryCodeOptionByIsoCode(preferredIsoCode);
    if (preferredOption) {
      return preferredOption;
    }
  }

  return COUNTRY_CODE_OPTIONS.find((option) => option.dialCode === normalizedDialCode) ?? null;
}

export function filterCountryCodeOptions(query: string) {
  const tokens = query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);

  if (tokens.length === 0) {
    return COUNTRY_CODE_OPTIONS;
  }

  return COUNTRY_CODE_OPTIONS.filter((option) => {
    const haystack = [
      option.name,
      option.isoCode,
      option.dialCode,
      ...(option.keywords ?? []),
    ]
      .join(' ')
      .toLowerCase();

    return tokens.every((token) => haystack.includes(token));
  });
}
