import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { RouteOptimizationController } from './route-optimization.controller';
import { RouteOptimizationService } from './route-optimization.service';

@Module({
  imports: [PrismaModule],
  providers: [RouteOptimizationService],
  controllers: [RouteOptimizationController],
  exports: [RouteOptimizationService],
})
export class RouteOptimizationModule {}
