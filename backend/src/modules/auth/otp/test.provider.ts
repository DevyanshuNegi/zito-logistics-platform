import { Injectable, Logger } from '@nestjs/common';
import {
  maskOtpTarget,
  OtpProvider,
  OtpProviderSendInput,
  OtpProviderSendResult,
} from './otp-provider.interface';

@Injectable()
export class TestOtpProvider implements OtpProvider {
  readonly mode = 'test' as const;
  private readonly logger = new Logger(TestOtpProvider.name);

  async send(input: OtpProviderSendInput): Promise<OtpProviderSendResult> {
    this.logger.warn(
      `TEST OTP MODE: simulated OTP for ${maskOtpTarget(input.contact)} (${input.purpose})`,
    );

    return {
      debugDeliveryTarget: maskOtpTarget(input.contact),
      debugOtp:
        process.env.EXPOSE_DEV_OTP === 'true'
          ? this.getConfiguredCode()
          : undefined,
    };
  }

  async verify(_contact: string, code: string): Promise<boolean> {
    return code.trim() === this.getConfiguredCode();
  }

  private getConfiguredCode() {
    return process.env.TEST_OTP_CODE?.trim() || '123456';
  }
}
