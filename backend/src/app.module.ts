import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { AuditModule } from './modules/users/audit.module';
import { LossDetectionModule } from './modules/loss-detection/loss-detection.module';
import { WarehouseModule } from './modules/warehouse/warehouse.module';
import { WaybillModule } from './modules/waybill/waybill.module';

@Module({
  imports: [
    PrismaModule, AuthModule, UsersModule, AuditModule,
    LossDetectionModule, WarehouseModule, WaybillModule
  ],
})
export class AppModule {}