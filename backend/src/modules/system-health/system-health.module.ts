import { Module } from '@nestjs/common';
import { RequestMetricsInterceptor } from '../../common/interceptors/request-metrics.interceptor';
import { RequestMetricsService } from '../../common/monitoring/request-metrics.service';
import { TelemetryService } from '../../common/monitoring/telemetry.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { BullmqMonitorService } from './bullmq-monitor.service';
import { SystemHealthController } from './system-health.controller';
import { SystemHealthService } from './system-health.service';

@Module({
  imports: [PrismaModule],
  controllers: [SystemHealthController],
  providers: [
    RequestMetricsService,
    RequestMetricsInterceptor,
    TelemetryService,
    BullmqMonitorService,
    SystemHealthService,
  ],
  exports: [
    RequestMetricsService,
    RequestMetricsInterceptor,
    TelemetryService,
    BullmqMonitorService,
    SystemHealthService,
  ],
})
export class SystemHealthModule {}
