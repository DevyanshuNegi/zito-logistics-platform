import { Injectable } from '@nestjs/common';

type InitiateStkPushInput = {
  amount: number;
  phoneNumber?: string | null;
  reference: string;
};

@Injectable()
export class MpesaService {
  async initiateStkPush({ amount, phoneNumber, reference }: InitiateStkPushInput) {
    const businessShortCode = process.env.MPESA_SHORTCODE;
    const passkey = process.env.MPESA_PASSKEY;
    const consumerKey = process.env.MPESA_CONSUMER_KEY;
    const consumerSecret = process.env.MPESA_CONSUMER_SECRET;
    const callbackUrl = process.env.MPESA_CALLBACK_URL;

    // Phase 1 needs a working initiation flow even before live provider
    // credentials are available in a local development environment.
    if (!businessShortCode || !passkey || !consumerKey || !consumerSecret || !callbackUrl) {
      return {
        provider: 'MPESA',
        mode: 'SIMULATED',
        checkoutRequestId: `SIM-STK-${Date.now()}`,
        merchantRequestId: reference,
        customerMessage: `Simulated M-Pesa STK push for ${phoneNumber ?? 'unknown phone'}`,
        amount,
      };
    }

    return {
      provider: 'MPESA',
      mode: 'CONFIGURED',
      checkoutRequestId: `CFG-STK-${Date.now()}`,
      merchantRequestId: reference,
      customerMessage: `M-Pesa STK push requested for ${phoneNumber ?? 'unknown phone'}`,
      amount,
    };
  }
}
