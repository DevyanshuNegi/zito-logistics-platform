import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { BookingsModule } from '../bookings/bookings.module';
import { SmsService } from '../notifications/channels/sms.service';
import { PaymentsModule } from '../payments/payments.module';
import { UssdController } from './ussd.controller';
import { UssdService } from './ussd.service';

@Module({
  imports: [PrismaModule, BookingsModule, PaymentsModule],
  controllers: [UssdController],
  providers: [UssdService, SmsService],
})
export class UssdModule {}
