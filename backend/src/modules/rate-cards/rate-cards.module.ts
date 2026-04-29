import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { RateCardsController } from './rate-cards.controller';
import { RateCardsService } from './rate-cards.service';

@Module({
  imports: [PrismaModule],
  controllers: [RateCardsController],
  providers: [RateCardsService],
  exports: [RateCardsService],
})
export class RateCardsModule {}
