import { Module } from '@nestjs/common';
import { PayrollService } from './payroll.service';
import { DriverPayrollController, AdminPayrollController } from './payroll.controller';
import { PrismaModule } from '../../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [DriverPayrollController, AdminPayrollController],
  providers: [PayrollService],
  exports: [PayrollService],
})
export class PayrollModule {}