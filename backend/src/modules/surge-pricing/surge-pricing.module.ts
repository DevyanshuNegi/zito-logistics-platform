import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { SurgePricingController } from './surge-pricing.controller';
import { SurgePricingService } from './surge-pricing.service';

@Module({
  imports: [PrismaModule],
  controllers: [SurgePricingController],
  providers: [SurgePricingService],
  exports: [SurgePricingService],
})
export class SurgePricingModule {}
