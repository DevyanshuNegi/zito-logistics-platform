export type OtpProviderMode = 'local' | 'test' | 'twilio' | 'firebase' | 'africastalking';

export type OtpProviderSendInput = {
  contact: string;
  purpose: string;
  code: string | null;
  isPhone: boolean;
};

export type OtpProviderSendResult = {
  debugOtp?: string;
  debugDeliveryTarget?: string;
};

export interface OtpProvider {
  readonly mode: OtpProviderMode;
  send(input: OtpProviderSendInput): Promise<OtpProviderSendResult>;
  verify?(contact: string, code: string): Promise<boolean>;
}

export function maskOtpTarget(contact: string) {
  if (contact.includes('@')) {
    const [name, domain] = contact.split('@');
    return `${name.slice(0, 2)}***@${domain ?? 'unknown'}`;
  }

  const normalized = contact.replace(/\s+/g, '');
  if (normalized.length <= 6) {
    return '***';
  }
  return `${normalized.slice(0, 4)}***${normalized.slice(-3)}`;
}
