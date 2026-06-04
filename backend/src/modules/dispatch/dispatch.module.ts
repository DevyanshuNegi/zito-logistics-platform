import { Module } from '@nestjs/common';
import { DispatchService } from './dispatch.service';
import { DispatchController } from './dispatch.controller';
import { DriverDispatchController } from './driver-dispatch.controller';
import { DriverMatchingModule } from '../drivers/matching/matching.module';
import { PrismaModule } from '../../prisma/prisma.module';

/**
 * Module 5: Dispatch System (PRD §16-18)
 * 
 * Responsible for:
 * - Driver matching and assignment orchestration
 * - Fallback logic (radius expansion, retry, manual override)
 * - Assignment lifecycle management (offer, accept, reject, reassign)
 * - Audit trail for all dispatch decisions
 */
@Module({
  imports: [DriverMatchingModule, PrismaModule],
  providers: [DispatchService],
  controllers: [DispatchController, DriverDispatchController],
  exports: [DispatchService],
})
export class DispatchModule {}
