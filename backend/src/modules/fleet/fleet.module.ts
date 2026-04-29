import { Module } from '@nestjs/common';
import { FleetController } from './fleet.controller';
import { FleetService } from './fleet.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { BreakdownService } from './breakdown/breakdown.service';
import { FleetExpiryService } from './fleet-expiry.service';

@Module({
  imports: [PrismaModule],
  controllers: [FleetController],
  providers: [FleetService, BreakdownService, FleetExpiryService],
  exports: [FleetService, BreakdownService, FleetExpiryService],
})
export class FleetModule {}
