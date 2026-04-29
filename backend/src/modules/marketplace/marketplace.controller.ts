import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import {
  CreateMarketplaceTransporterDto,
  CreateMarketplaceWarehouseDto,
  MarketplaceBidDto,
  PublishMarketplaceOpportunityDto,
  RespondMarketplaceBidDto,
  SelfMarketplaceTransporterDto,
  SelfMarketplaceWarehouseDto,
  UpdateMarketplacePartnerStatusDto,
} from './dto/marketplace.dto';
import { MarketplaceService } from './marketplace.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('marketplace')
export class MarketplaceController {
  constructor(private readonly marketplaceService: MarketplaceService) {}

  @Get('dashboard')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  dashboard() {
    return this.marketplaceService.dashboard();
  }

  @Get('partners')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  listPartners(
    @Query('type') type?: string,
    @Query('status') status?: string,
  ) {
    return this.marketplaceService.listPartners({ type, status });
  }

  @Get('opportunities')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  listOpportunities(@Query('status') status?: string) {
    return this.marketplaceService.listOpportunities({ status });
  }

  @Post('monitor')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  monitorPartners() {
    return this.marketplaceService.monitorPartners();
  }

  @Post('partners/transporter')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  onboardTransporter(
    @Body() dto: CreateMarketplaceTransporterDto,
    @Req() req: any,
  ) {
    return this.marketplaceService.onboardTransporter(dto, req.user.id);
  }

  @Post('partners/warehouse')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  onboardWarehouse(
    @Body() dto: CreateMarketplaceWarehouseDto,
    @Req() req: any,
  ) {
    return this.marketplaceService.onboardWarehouse(dto, req.user.id);
  }

  @Patch('partners/:userId/status')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  updatePartnerStatus(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: UpdateMarketplacePartnerStatusDto,
    @Req() req: any,
  ) {
    return this.marketplaceService.updatePartnerStatus(userId, dto, req.user.id);
  }

  @Post('bookings/:bookingId/publish')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  publishOpportunity(
    @Param('bookingId', ParseUUIDPipe) bookingId: string,
    @Body() dto: PublishMarketplaceOpportunityDto,
    @Req() req: any,
  ) {
    return this.marketplaceService.publishOpportunity(bookingId, dto, req.user.id);
  }

  @Get('partner/profile')
  @Roles(UserRole.TRANSPORTER, UserRole.WAREHOUSE_PARTNER)
  getPartnerProfile(@Req() req: any) {
    return this.marketplaceService.getPartnerProfile(req.user.id);
  }

  @Get('partner/opportunities')
  @Roles(UserRole.TRANSPORTER, UserRole.WAREHOUSE_PARTNER)
  listPartnerOpportunities(@Req() req: any) {
    return this.marketplaceService.listPartnerOpportunities(req.user.id);
  }

  @Post('partner/transporter/onboard')
  @Roles(UserRole.TRANSPORTER)
  selfOnboardTransporter(
    @Body() dto: SelfMarketplaceTransporterDto,
    @Req() req: any,
  ) {
    return this.marketplaceService.onboardTransporter(
      {
        ...dto,
        userId: req.user.id,
      },
      req.user.id,
    );
  }

  @Post('partner/warehouse/onboard')
  @Roles(UserRole.WAREHOUSE_PARTNER)
  selfOnboardWarehouse(
    @Body() dto: SelfMarketplaceWarehouseDto,
    @Req() req: any,
  ) {
    return this.marketplaceService.onboardWarehouse(
      {
        ...dto,
        userId: req.user.id,
      },
      req.user.id,
    );
  }

  @Post('partner/opportunities/:bookingId/accept')
  @Roles(UserRole.TRANSPORTER, UserRole.WAREHOUSE_PARTNER)
  acceptOpportunity(
    @Param('bookingId', ParseUUIDPipe) bookingId: string,
    @Req() req: any,
  ) {
    return this.marketplaceService.acceptOpportunity(bookingId, req.user.id);
  }

  @Post('partner/opportunities/:bookingId/bids')
  @Roles(UserRole.TRANSPORTER, UserRole.WAREHOUSE_PARTNER)
  submitBid(
    @Param('bookingId', ParseUUIDPipe) bookingId: string,
    @Body() dto: MarketplaceBidDto,
    @Req() req: any,
  ) {
    return this.marketplaceService.submitBid(bookingId, req.user.id, dto);
  }

  @Patch('opportunities/:bookingId/bids/:bidId')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  respondToBid(
    @Param('bookingId', ParseUUIDPipe) bookingId: string,
    @Param('bidId') bidId: string,
    @Body() dto: RespondMarketplaceBidDto,
    @Req() req: any,
  ) {
    return this.marketplaceService.respondToBid(
      bookingId,
      bidId,
      dto,
      req.user.id,
    );
  }
}
