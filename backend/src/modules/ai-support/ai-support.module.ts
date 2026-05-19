import { Module } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SupportModule } from '../support/support.module';
import { AiSupportController } from './ai-support.controller';
import { AiSupportService } from './ai-support.service';
import { CustomerAiPolicyService } from './customer-ai-policy.service';
import { CustomerAiToolsService } from './customer-ai-tools.service';

@Module({
  imports: [SupportModule],
  controllers: [AiSupportController],
  providers: [
    AiSupportService,
    CustomerAiPolicyService,
    CustomerAiToolsService,
    PrismaService,
  ],
})
export class AiSupportModule {}
