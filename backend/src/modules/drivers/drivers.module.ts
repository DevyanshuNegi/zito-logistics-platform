import { Module } from '@nestjs/common';
import { DriversController } from './drivers.controller';
import { DriversService } from './drivers.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { DriverMatchingModule } from './matching/matching.module';
import { PayrollModule } from './payroll/payroll.module';
import { IncentivesController } from './incentives/incentives.controller';
import { IncentivesService } from './incentives/incentives.service';
import { ShiftController } from './shift/shift.controller';
import { ShiftService } from './shift/shift.service';
import { ShiftActiveGuard } from './shift/shift-active.guard';

@Module({
  imports: [PrismaModule, DriverMatchingModule, PayrollModule],
  controllers: [DriversController, ShiftController, IncentivesController],
  providers: [DriversService, ShiftService, ShiftActiveGuard, IncentivesService],
  exports: [DriversService, ShiftService, ShiftActiveGuard, IncentivesService],
})
export class DriversModule {}
