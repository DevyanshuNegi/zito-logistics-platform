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
import { ServiceType, UserRole, VehicleType } from '@prisma/client';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import {
  CalculateRateCardDto,
  CreateRateCardDto,
  UpdateRateCardDto,
} from './dto/rate-card.dto';
import { RateCardsService } from './rate-cards.service';

@ApiTags('RateCards')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
@Controller('rate-cards')
export class RateCardsController {
  constructor(private readonly rateCardsService: RateCardsService) {}

  @Get('countries/config')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.AGENCY_STAFF,
    UserRole.CUSTOMER,
    UserRole.CORPORATE,
    UserRole.TRANSPORTER,
    UserRole.DRIVER,
  )
  @ApiOperation({ summary: 'List country pricing and tax configuration (PRD Â§49)' })
  @ApiQuery({ name: 'countryCode', required: false, type: String })
  countryConfig(@Query('countryCode') countryCode?: string) {
    return this.rateCardsService.countryConfig(countryCode);
  }

  @Get('currencies/supported')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.AGENCY_STAFF,
    UserRole.CUSTOMER,
    UserRole.CORPORATE,
    UserRole.TRANSPORTER,
    UserRole.DRIVER,
  )
  @ApiOperation({ summary: 'List supported billing currencies (PRD §23)' })
  supportedCurrencies() {
    return this.rateCardsService.listSupportedCurrencies();
  }

  @Get()
  @ApiOperation({ summary: 'List rate cards and version history (PRD §19)' })
  @ApiQuery({ name: 'vehicleType', required: false, enum: VehicleType })
  @ApiQuery({ name: 'serviceType', required: false, enum: ServiceType })
  @ApiQuery({ name: 'includeInactive', required: false, type: Boolean })
  list(
    @Query('vehicleType') vehicleType?: VehicleType,
    @Query('serviceType') serviceType?: ServiceType,
    @Query('includeInactive') includeInactive = 'false',
  ) {
    return this.rateCardsService.list({
      vehicleType,
      serviceType,
      includeInactive: includeInactive === 'true',
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a rate card version by ID (PRD §19)' })
  getById(@Param('id', ParseUUIDPipe) id: string) {
    return this.rateCardsService.getById(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a rate card version (PRD §19)' })
  create(@Body() dto: CreateRateCardDto, @Req() req: any) {
    return this.rateCardsService.create(dto, req.user.id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Publish a new version of a rate card (PRD §19)' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRateCardDto,
    @Req() req: any,
  ) {
    return this.rateCardsService.update(id, dto, req.user.id);
  }

  @Post('calculate')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.AGENCY_STAFF,
    UserRole.CUSTOMER,
    UserRole.CORPORATE,
    UserRole.TRANSPORTER,
  )
  @ApiOperation({ summary: 'Calculate pricing from the active rate card (PRD §19)' })
  calculate(@Body() dto: CalculateRateCardDto) {
    return this.rateCardsService.calculate(dto);
  }
}
