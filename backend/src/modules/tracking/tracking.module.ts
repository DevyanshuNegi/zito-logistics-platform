import { Module } from '@nestjs/common';
import { TrackingGateway } from './tracking.gateway';
import { TrackingController } from './tracking.controller';
import { TrackingService } from './tracking.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [TrackingGateway, TrackingService],
  controllers: [TrackingController],
  exports: [TrackingGateway],
})
export class TrackingModule {}

