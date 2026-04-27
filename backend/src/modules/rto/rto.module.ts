import { Module } from '@nestjs/common';
import { RtoService } from './rto.service';
import { RtoController } from './rto.controller';

@Module({
  providers: [RtoService],
  controllers: [RtoController]
})
export class RtoModule {}
