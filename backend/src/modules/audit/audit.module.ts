import { Module, forwardRef } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { BookingsModule } from '../bookings/bookings.module';
import { PayrollModule } from '../drivers/payroll/payroll.module';
import { PaymentsModule } from '../payments/payments.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';
import { VerificationFeeController } from './verification-fee.controller';
import { VerificationFeeService } from './verification-fee.service';

@Module({
  imports: [
    PrismaModule,
    forwardRef(() => PaymentsModule),
    forwardRef(() => BookingsModule),
    PayrollModule,
    NotificationsModule,
  ],
  controllers: [AuditController, VerificationFeeController],
  providers: [AuditService, VerificationFeeService],
  exports: [AuditService, VerificationFeeService],
})
export class AuditModule {}
