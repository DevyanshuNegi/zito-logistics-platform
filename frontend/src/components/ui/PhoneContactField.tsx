'use client';

import { CountryCodeSelect } from '@/components/ui/CountryCodeSelect';
import { Input } from '@/components/ui/Input';

type PhoneContactFieldProps = {
  countryOptionCode: string;
  phoneNumber: string;
  onCountryChange: (isoCode: string) => void;
  onPhoneChange: (phoneNumber: string) => void;
  required?: boolean;
  tone?: 'dark' | 'light';
  countryCodeLabel?: string;
  phoneLabel?: string;
  help?: string;
  className?: string;
};

export function PhoneContactField({
  countryOptionCode,
  phoneNumber,
  onCountryChange,
  onPhoneChange,
  required = false,
  tone = 'dark',
  countryCodeLabel = 'Country code',
  phoneLabel = 'Phone number',
  help = 'Enter the local number without the country code.',
  className = '',
}: PhoneContactFieldProps) {
  return (
    <div className={['flex flex-col gap-4 sm:flex-row sm:items-start', className].join(' ')}>
      <div className="sm:w-[132px] sm:shrink-0">
        <CountryCodeSelect
          label={countryCodeLabel}
          value={countryOptionCode}
          onChange={onCountryChange}
          compact
          tone={tone}
        />
      </div>
      <div className="sm:min-w-0 sm:flex-1">
        <Input
          label={phoneLabel}
          value={phoneNumber}
          onChange={(event) => onPhoneChange(event.target.value)}
          autoComplete="tel-national"
          inputMode="numeric"
          help={help}
          required={required}
          tone={tone}
        />
      </div>
    </div>
  );
}
