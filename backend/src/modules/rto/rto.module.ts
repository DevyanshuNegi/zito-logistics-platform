import { Module } from '@nestjs/common';
import { RtoService } from './rto.service';
import { RtoController } from './rto.controller';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule], // ✅ REQUIRED
  providers: [RtoService],
  controllers: [RtoController],
})
export class RtoModule {}