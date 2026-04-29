import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { EscrowModule } from './escrow/escrow.module';
import { MpesaService } from './mpesa/mpesa.service';

@Module({
  imports: [PrismaModule, EscrowModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, MpesaService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
