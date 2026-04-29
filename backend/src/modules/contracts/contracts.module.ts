import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import {
  AdminContractsController,
  ContractsController,
  CorporateContractsController,
} from './contracts.controller';
import { ContractsService } from './contracts.service';

@Module({
  imports: [PrismaModule],
  controllers: [
    ContractsController,
    AdminContractsController,
    CorporateContractsController,
  ],
  providers: [ContractsService],
  exports: [ContractsService],
})
export class ContractsModule {}
