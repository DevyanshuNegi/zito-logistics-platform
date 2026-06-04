import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import {
  maskOtpTarget,
  OtpProvider,
  OtpProviderSendInput,
  OtpProviderSendResult,
} from './otp-provider.interface';

const OTP_PROVIDER_TIMEOUT_MS = 10000;

@Injectable()
export class TwilioOtpProvider implements OtpProvider {
  readonly mode = 'twilio' as const;
  private readonly logger = new Logger(TwilioOtpProvider.name);

  async send(input: OtpProviderSendInput): Promise<OtpProviderSendResult> {
    if (!input.isPhone) {
      throw new HttpException(
        { message: 'Twilio Verify SMS requires a phone number.', data: {} },
        HttpStatus.BAD_REQUEST,
      );
    }

    const deliveryTarget = this.getPhoneDeliveryTarget(input.contact);
    await this.sendTwilioVerification(deliveryTarget);

    if (process.env.NODE_ENV !== 'production') {
      this.logger.debug(
        `OTP sent via Twilio to ${maskOtpTarget(deliveryTarget)} (${input.purpose})`,
      );
    }

    return {
      debugDeliveryTarget: maskOtpTarget(deliveryTarget),
    };
  }

  async verify(contact: string, code: string): Promise<boolean> {
    const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID;
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;

    if (!serviceSid || !accountSid || !authToken) {
      return false;
    }

    const payload = new URLSearchParams({
      To: this.getPhoneDeliveryTarget(contact),
      Code: code,
    });

    try {
      const response = await axios.post(
        `https://verify.twilio.com/v2/Services/${serviceSid}/VerificationCheck`,
        payload.toString(),
        {
          auth: {
            username: accountSid,
            password: authToken,
          },
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          proxy: false,
          timeout: OTP_PROVIDER_TIMEOUT_MS,
        },
      );

      const status =
        typeof response.data?.status === 'string'
          ? response.data.status.toLowerCase()
          : '';
      const valid = response.data?.valid === true;

      return valid || status === 'approved';
    } catch {
      return false;
    }
  }

  private async sendTwilioVerification(to: string) {
    const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID;
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;

    if (!serviceSid || !accountSid || !authToken) {
      throw new HttpException(
        {
          message: 'OTP delivery is not configured correctly. Please contact support.',
          data: {},
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const payload = new URLSearchParams({
      To: to,
      Channel: 'sms',
    });

    const appHash = process.env.TWILIO_VERIFY_ANDROID_APP_HASH?.trim();
    if (appHash) {
      payload.set('AppHash', appHash);
    }

    try {
      await axios.post(
        `https://verify.twilio.com/v2/Services/${serviceSid}/Verifications`,
        payload.toString(),
        {
          auth: {
            username: accountSid,
            password: authToken,
          },
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          proxy: false,
          timeout: OTP_PROVIDER_TIMEOUT_MS,
        },
      );
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        this.logger.warn(
          `Twilio Verify send failed for ${maskOtpTarget(to)}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }

      throw new HttpException(
        {
          message: 'Unable to send OTP right now. Please try again shortly.',
          data: {},
        },
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  private getPhoneDeliveryTarget(contact: string) {
    const redirectEnabled = process.env.OTP_TEST_REDIRECT_ENABLED === 'true';
    const overrideTarget = process.env.OTP_TEST_REDIRECT_PHONE?.trim();
    if (
      redirectEnabled &&
      overrideTarget &&
      process.env.NODE_ENV !== 'production' &&
      /^\+?[0-9]{9,15}$/.test(overrideTarget)
    ) {
      return overrideTarget;
    }

    return contact;
  }
}
