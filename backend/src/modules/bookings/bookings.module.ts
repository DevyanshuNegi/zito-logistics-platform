import { Module } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import {
  CustomerBookingsController,
  DriverTripsController,
  AdminBookingsController,
} from './bookings.controller';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [
    CustomerBookingsController,
    DriverTripsController,
    AdminBookingsController,
  ],
  providers: [BookingsService],
  exports: [BookingsService],
})
export class BookingsModule {}