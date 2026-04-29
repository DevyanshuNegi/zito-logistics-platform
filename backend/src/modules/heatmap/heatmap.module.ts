import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { HeatmapController } from './heatmap.controller';
import { HeatmapService } from './heatmap.service';

@Module({
  imports: [PrismaModule],
  controllers: [HeatmapController],
  providers: [HeatmapService],
  exports: [HeatmapService],
})
export class HeatmapModule {}
