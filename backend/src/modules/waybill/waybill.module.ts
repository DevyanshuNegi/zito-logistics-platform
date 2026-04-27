import { Module } from '@nestjs/common';
import { WaybillService } from './waybill.service';
import { WaybillController } from './waybill.controller';

@Module({
  providers: [WaybillService],
  controllers: [WaybillController]
})
export class WaybillModule {}
