import { Module, forwardRef } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { EscrowModule } from './escrow/escrow.module';
import { MpesaService } from './mpesa/mpesa.service';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [PrismaModule, EscrowModule, forwardRef(() => AuditModule)],
  controllers: [PaymentsController],
  providers: [PaymentsService, MpesaService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
