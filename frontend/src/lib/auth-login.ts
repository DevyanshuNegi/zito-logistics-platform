export type LoginMode = 'phone_otp' | 'email_otp';

export const DEFAULT_COUNTRY_CODE = '+91';

export function isEmailIdentifier(value: string) {
  return value.includes('@');
}

export function normalizeCountryCode(value: string) {
  const digits = value.replace(/\D/g, '');
  return digits ? `+${digits}` : '+';
}

export function normalizePhoneNumber(value: string) {
  return value.replace(/\D/g, '');
}

export function buildPhoneContact(countryCode: string, phoneNumber: string) {
  const normalizedCode = normalizeCountryCode(countryCode);
  const normalizedNumber = normalizePhoneNumber(phoneNumber).replace(/^0+/, '');
  return `${normalizedCode}${normalizedNumber}`;
}

export function maskContact(contact: string) {
  if (isEmailIdentifier(contact)) {
    const [localPart, domain = ''] = contact.split('@');
    const visibleLocal = localPart.slice(0, 1);
    const maskedLocal = `${visibleLocal}${'*'.repeat(Math.max(2, localPart.length - 1))}`;

    if (!domain) {
      return maskedLocal;
    }

    const [domainName, suffix = ''] = domain.split('.');
    const visibleDomain = domainName.slice(0, 1);
    const maskedDomain = `${visibleDomain}${'*'.repeat(Math.max(2, domainName.length - 1))}`;
    return `${maskedLocal}@${maskedDomain}${suffix ? `.${suffix}` : ''}`;
  }

  const digits = contact.replace(/\D/g, '');
  if (digits.length <= 4) {
    return contact;
  }

  const lead = digits.slice(0, Math.min(3, Math.max(1, digits.length - 4)));
  const tail = digits.slice(-4);
  const hidden = '*'.repeat(Math.max(3, digits.length - lead.length - tail.length));
  const prefix = contact.trim().startsWith('+') ? '+' : '';
  return `${prefix}${lead}${hidden}${tail}`;
}

export function secondsUntil(isoDate?: string | null) {
  if (!isoDate) {
    return 0;
  }

  const difference = new Date(isoDate).getTime() - Date.now();
  return Math.max(0, Math.ceil(difference / 1000));
}
