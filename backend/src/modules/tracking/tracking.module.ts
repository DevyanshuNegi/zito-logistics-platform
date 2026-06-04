import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TrackingGateway } from './tracking.gateway';
import { TrackingController } from './tracking.controller';
import { TrackingService } from './tracking.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { RouteOptimizationModule } from '../route-optimization/route-optimization.module';

@Module({
  imports: [
    PrismaModule,
    RouteOptimizationModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'zito-secure-secret-key',
    }),
  ],
  providers: [TrackingGateway, TrackingService],
  controllers: [TrackingController],
  exports: [TrackingGateway],
})
export class TrackingModule {}
