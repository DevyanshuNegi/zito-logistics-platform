import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { MarketplaceController } from './marketplace.controller';
import { MarketplaceService } from './marketplace.service';
import { FeaturedListingsController } from './featured-listings.controller';
import { FeaturedListingsService } from './featured-listings.service';
import { PaymentsModule } from '../payments/payments.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [PrismaModule, PaymentsModule, NotificationsModule],
  controllers: [MarketplaceController, FeaturedListingsController],
  providers: [MarketplaceService, FeaturedListingsService],
  exports: [MarketplaceService, FeaturedListingsService],
})
export class MarketplaceModule {}
