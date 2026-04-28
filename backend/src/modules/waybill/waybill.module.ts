import { Module } from '@nestjs/common';
import { WaybillService } from './waybill.service';
import { WaybillController } from './waybill.controller';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [WaybillService],
  controllers: [WaybillController],
  exports: [WaybillService],
})
export class WaybillModule {}