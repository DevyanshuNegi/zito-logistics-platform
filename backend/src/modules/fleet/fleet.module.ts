import { Module } from '@nestjs/common';
import { FleetController } from './fleet.controller';
import { FleetService } from './fleet.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { BreakdownService } from './breakdown/breakdown.service';
import { FleetExpiryService } from './fleet-expiry.service';
import { FuelService } from './fuel/fuel.service';

@Module({
  imports: [PrismaModule],
  controllers: [FleetController],
  providers: [FleetService, BreakdownService, FleetExpiryService, FuelService],
  exports: [FleetService, BreakdownService, FleetExpiryService, FuelService],
})
export class FleetModule {}
