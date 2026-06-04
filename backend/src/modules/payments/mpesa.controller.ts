import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import * as crypto from 'crypto';

import { PaymentsService } from './payments.service';
import { PrismaService } from '../../prisma/prisma.service';

@ApiExcludeController()
@Controller('payments/mpesa')
export class MpesaController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('callback')
  @HttpCode(HttpStatus.OK)
  async handleCallback(
    @Body() payload: Record<string, unknown>,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Req() req: any,
  ) {
    await this.verifyCallbackRequest(headers, req, 'callback');
    await this.paymentsService.handleMpesaCallback(payload);

    return {
      ResultCode: 0,
      ResultDesc: 'Accepted',
    };
  }

  @Post('result')
  @HttpCode(HttpStatus.OK)
  async handleResult(
    @Body() payload: Record<string, unknown>,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Req() req: any,
  ) {
    await this.verifyCallbackRequest(headers, req, 'result');
    await this.paymentsService.handleMpesaProviderResult(payload);

    return {
      ResultCode: 0,
      ResultDesc: 'Accepted',
    };
  }

  @Post('timeout')
  @HttpCode(HttpStatus.OK)
  async handleTimeout(
    @Body() payload: Record<string, unknown>,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Req() req: any,
  ) {
    await this.verifyCallbackRequest(headers, req, 'timeout');
    await this.paymentsService.handleMpesaProviderTimeout(payload);

    return {
      ResultCode: 0,
      ResultDesc: 'Accepted',
    };
  }

  private async verifyCallbackRequest(
    headers: Record<string, string | string[] | undefined>,
    req: any,
    endpoint: string,
  ) {
    const clientIp = this.getClientIp(req);
    const allowedIps = (process.env.MPESA_CALLBACK_IP_ALLOWLIST ?? '')
      .split(',')
      .map((ip) => ip.trim())
      .filter(Boolean);

    if (allowedIps.length > 0 && !allowedIps.includes(clientIp)) {
      await this.writeSecurityAlert(endpoint, clientIp, 'IP_NOT_ALLOWED');
      throw new UnauthorizedException('M-Pesa callback source is not allowed');
    }

    const expectedSecret = process.env.MPESA_CALLBACK_SECRET?.trim();
    if (!expectedSecret) {
      if (process.env.NODE_ENV === 'production') {
        await this.writeSecurityAlert(endpoint, clientIp, 'SECRET_NOT_CONFIGURED');
        throw new UnauthorizedException('M-Pesa callback verification is not configured');
      }
      return;
    }

    const suppliedSecret = this.headerValue(headers, 'x-zito-mpesa-secret')
      || this.headerValue(headers, 'x-mpesa-callback-secret')
      || this.headerValue(headers, 'x-callback-secret');

    if (!this.secureCompare(suppliedSecret, expectedSecret)) {
      await this.writeSecurityAlert(endpoint, clientIp, 'SECRET_MISMATCH');
      throw new UnauthorizedException('M-Pesa callback verification failed');
    }
  }

  private headerValue(headers: Record<string, string | string[] | undefined>, key: string) {
    const direct = headers[key] ?? headers[key.toLowerCase()];
    if (Array.isArray(direct)) {
      return direct[0] ?? '';
    }
    return direct ?? '';
  }

  private secureCompare(actual: string | undefined, expected: string) {
    if (!actual) {
      return false;
    }
    const actualBuffer = Buffer.from(actual);
    const expectedBuffer = Buffer.from(expected);
    return actualBuffer.length === expectedBuffer.length
      && crypto.timingSafeEqual(actualBuffer, expectedBuffer);
  }

  private getClientIp(req: any) {
    const forwarded = req.headers?.['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.trim()) {
      return forwarded.split(',')[0].trim();
    }
    return req.ip ?? req.socket?.remoteAddress ?? 'unknown';
  }

  private async writeSecurityAlert(endpoint: string, ipAddress: string, reason: string) {
    await this.prisma.internalAlert.create({
      data: {
        type: 'MPESA_CALLBACK_SECURITY',
        severity: 'CRITICAL',
        message: `Rejected M-Pesa ${endpoint} callback: ${reason}`,
        entityType: 'PAYMENT',
        entityId: endpoint,
        metadata: {
          endpoint,
          ipAddress,
          reason,
          rejectedAt: new Date().toISOString(),
        },
      },
    }).catch(() => undefined);
  }
}
