import { Module } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { QuotationsService } from './quotations.service';
import { AdminQuotationController, CustomerQuotationController } from './quotations.controller';

@Module({
  providers: [QuotationsService, PrismaService],
  controllers: [AdminQuotationController, CustomerQuotationController],
  exports: [QuotationsService],
})
export class QuotationsModule {}
