import { Module } from '@nestjs/common';
import { LossDetectionService } from './loss-detection.service';
import { LossDetectionController } from './loss-detection.controller';

@Module({
  providers: [LossDetectionService],
  controllers: [LossDetectionController]
})
export class LossDetectionModule {}
