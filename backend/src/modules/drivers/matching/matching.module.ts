import { Module } from '@nestjs/common';
import { DriverMatchingService } from './matching.service';
import { AdminMatchingController, DriverLocationController } from './matching.controller';
import { PrismaModule } from '../../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [AdminMatchingController, DriverLocationController],
  providers: [DriverMatchingService],
  exports: [DriverMatchingService],
})
export class DriverMatchingModule {}