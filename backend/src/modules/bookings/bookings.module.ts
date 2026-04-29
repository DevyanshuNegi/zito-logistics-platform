import { Module, forwardRef } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import {
  CustomerBookingsController,
  CorporateBookingsController,
  DriverTripsController,
  AdminBookingsController,
} from './bookings.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { PaymentsModule } from '../payments/payments.module';
import { DriversModule } from '../drivers/drivers.module';
import { InvoicesModule } from '../invoices/invoices.module';
import { ContractsModule } from '../contracts/contracts.module';
import { AuditModule } from '../audit/audit.module';
import { SurgePricingModule } from '../surge-pricing/surge-pricing.module';

@Module({
  imports: [
    PrismaModule,
    PaymentsModule,
    DriversModule,
    InvoicesModule,
    ContractsModule,
    SurgePricingModule,
    forwardRef(() => AuditModule),
  ],
  controllers: [
    CustomerBookingsController,
    CorporateBookingsController,
    DriverTripsController,
    AdminBookingsController,
  ],
  providers: [BookingsService],
  exports: [BookingsService],
})
export class BookingsModule {}
