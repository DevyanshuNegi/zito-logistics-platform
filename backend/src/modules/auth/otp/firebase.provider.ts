import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import {
  OtpProvider,
  OtpProviderSendInput,
  OtpProviderSendResult,
} from './otp-provider.interface';

@Injectable()
export class FirebaseOtpProvider implements OtpProvider {
  readonly mode = 'firebase' as const;

  async send(_input: OtpProviderSendInput): Promise<OtpProviderSendResult> {
    throw new HttpException(
      {
        message: 'Firebase OTP provider is not implemented yet.',
        data: {},
      },
      HttpStatus.NOT_IMPLEMENTED,
    );
  }

  async verify(): Promise<boolean> {
    return false;
  }
}
