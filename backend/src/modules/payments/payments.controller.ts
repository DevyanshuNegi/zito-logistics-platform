import { Controller, Post, Body, Get, Param, UseGuards } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Roles('CUSTOMER')
  @Post('mpesa')
  initiateMpesa(@CurrentUser() user: any, @Body() initiatePaymentDto: InitiatePaymentDto) {
    return this.paymentsService.initiateMpesaPayment(initiatePaymentDto, user.id);
  }

  @Roles('CUSTOMER', 'ADMIN')
  @Get('verify/:reference')
  verifyPayment(@Param('reference') reference: string) {
    return this.paymentsService.verifyPayment(reference);
  }
}
