import { Module } from '@nestjs/common';
import { RtoService } from './rto.service';
import { RtoController } from './rto.controller';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [RtoService],
  controllers: [RtoController],
  exports: [RtoService],
})
export class RtoModule {}
