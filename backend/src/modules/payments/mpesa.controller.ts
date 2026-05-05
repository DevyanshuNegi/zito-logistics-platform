import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';

import { PaymentsService } from './payments.service';

@ApiExcludeController()
@Controller('payments/mpesa')
export class MpesaController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('callback')
  @HttpCode(HttpStatus.OK)
  async handleCallback(@Body() payload: Record<string, unknown>) {
    await this.paymentsService.handleMpesaCallback(payload);

    return {
      ResultCode: 0,
      ResultDesc: 'Accepted',
    };
  }

  @Post('result')
  @HttpCode(HttpStatus.OK)
  async handleResult(@Body() payload: Record<string, unknown>) {
    await this.paymentsService.handleMpesaProviderResult(payload);

    return {
      ResultCode: 0,
      ResultDesc: 'Accepted',
    };
  }

  @Post('timeout')
  @HttpCode(HttpStatus.OK)
  async handleTimeout(@Body() payload: Record<string, unknown>) {
    await this.paymentsService.handleMpesaProviderTimeout(payload);

    return {
      ResultCode: 0,
      ResultDesc: 'Accepted',
    };
  }
}
