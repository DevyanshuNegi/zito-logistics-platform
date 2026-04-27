import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { AgenciesModule } from './modules/agencies/agencies.module';
import { StaffModule } from './modules/staff/staff.module';
import { BookingsModule } from './modules/bookings/bookings.module';
import { DriversModule } from './modules/drivers/drivers.module';
import { FleetModule } from './modules/fleet/fleet.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { TrackingModule } from './modules/tracking/tracking.module';
import { SupportModule } from './modules/support/support.module';
import { WarehouseModule } from './modules/warehouse/warehouse.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { WaybillModule } from './modules/waybill/waybill.module';
import { ScanModule } from './modules/scan/scan.module';
import { LossDetectionModule } from './modules/loss-detection/loss-detection.module';
import { RtoModule } from './modules/rto/rto.module';

@Module({
  imports: [
    PrismaModule, AuthModule, UsersModule, AgenciesModule, StaffModule, BookingsModule, DriversModule, FleetModule, PaymentsModule, NotificationsModule, TrackingModule, SupportModule, WarehouseModule, InventoryModule, WaybillModule, ScanModule, LossDetectionModule, RtoModule
  ],
})
export class AppModule {}