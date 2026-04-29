import { Module } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import {
  CustomerBookingsController,
  DriverTripsController,
  AdminBookingsController,
} from './bookings.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { PaymentsModule } from '../payments/payments.module';
import { DriversModule } from '../drivers/drivers.module';

@Module({
  imports: [PrismaModule, PaymentsModule, DriversModule],
  controllers: [
    CustomerBookingsController,
    DriverTripsController,
    AdminBookingsController,
  ],
  providers: [BookingsService],
  exports: [BookingsService],
})
export class BookingsModule {}
