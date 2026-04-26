import { Module } from '@nestjs/common';
import { LossDetectionService } from './loss-detection.service';
import { LossDetectionController } from './loss-detection.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { AlertsModule } from '../alerts/alerts.module';

@Module({
  imports: [PrismaModule, AlertsModule],
  providers: [LossDetectionService],
  controllers: [LossDetectionController],
  exports: [LossDetectionService],
})
export class LossDetectionModule {}