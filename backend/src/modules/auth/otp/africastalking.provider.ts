import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import AfricasTalking from 'africastalking';
import {
  OtpProvider,
  OtpProviderMode,
  OtpProviderSendInput,
  OtpProviderSendResult,
  maskOtpTarget,
} from './otp-provider.interface';

@Injectable()
export class AfricasTalkingOtpProvider implements OtpProvider {
  private readonly logger = new Logger(AfricasTalkingOtpProvider.name);
  readonly mode: OtpProviderMode = 'africastalking';
  private at: any;

  constructor() {
    this.logger.log(`Initializing AfricasTalkingOtpProvider... AT_USERNAME=${process.env.AT_USERNAME || 'not set'}`);
    if (process.env.AT_USERNAME && process.env.AT_API_KEY) {
      try {
        this.at = AfricasTalking({
          apiKey: process.env.AT_API_KEY,
          username: process.env.AT_USERNAME,
        });
        this.logger.log("Africa's Talking SDK initialized successfully.");
      } catch (err: any) {
        this.logger.error(`Failed to initialize Africa's Talking SDK: ${err.message}`);
      }
    } else {
      this.logger.warn("Africa's Talking credentials missing from environment variables.");
    }
  }

  async send(input: OtpProviderSendInput): Promise<OtpProviderSendResult> {
    if (!this.at) {
      this.logger.warn("Africa's Talking credentials missing. OTP bypassed.");
      return {
        debugOtp: input.code ?? undefined,
        debugDeliveryTarget: maskOtpTarget(input.contact),
      };
    }

    if (!input.isPhone) {
      throw new HttpException(
        "Africa's Talking can only send OTPs to phone numbers",
        HttpStatus.BAD_REQUEST,
      );
    }

    const message = `Your Zito Logistics verification code is ${input.code}. It will expire in 5 minutes.`;

    try {
      await this.at.SMS.send({
        to: [input.contact],
        message,
        // from: 'ZITO' // Uncomment if you have a registered sender ID
      });

      this.logger.log(
        `Africa's Talking OTP sent to ${maskOtpTarget(input.contact)} (${input.purpose})`,
      );

      return {};
    } catch (error: any) {
      this.logger.error(
        `Failed to send Africa's Talking SMS to ${maskOtpTarget(input.contact)}: ${error.message}`,
      );
      throw new HttpException(
        'Failed to deliver SMS. Please try again later.',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }
}
