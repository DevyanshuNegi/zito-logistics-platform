import { Module } from '@nestjs/common';
import { DriversController } from './drivers.controller';
import { DriversService } from './drivers.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { DriverMatchingModule } from './matching/matching.module';
import { PayrollModule } from './payroll/payroll.module';
import { ShiftController } from './shift/shift.controller';
import { ShiftService } from './shift/shift.service';
import { ShiftActiveGuard } from './shift/shift-active.guard';

@Module({
  imports: [PrismaModule, DriverMatchingModule, PayrollModule],
  controllers: [DriversController, ShiftController],
  providers: [DriversService, ShiftService, ShiftActiveGuard],
  exports: [DriversService, ShiftService, ShiftActiveGuard],
})
export class DriversModule {}
