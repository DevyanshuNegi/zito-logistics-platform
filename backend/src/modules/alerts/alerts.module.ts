import { Module } from '@nestjs/common';
import { AlertsService } from './alerts.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { AlertsController } from './alerts.controller';

@Module({
  imports: [PrismaModule],
  providers: [AlertsService],
  controllers: [AlertsController],
  exports: [AlertsService],
})
export class AlertsModule {}