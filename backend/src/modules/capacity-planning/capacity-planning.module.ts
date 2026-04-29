import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { CapacityPlanningController } from './capacity-planning.controller';
import { CapacityPlanningService } from './capacity-planning.service';

@Module({
  imports: [PrismaModule],
  controllers: [CapacityPlanningController],
  providers: [CapacityPlanningService],
  exports: [CapacityPlanningService],
})
export class CapacityPlanningModule {}
