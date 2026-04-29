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
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ContractsService } from './contracts.service';
import { CreateContractDto, UpdateContractDto } from './dto/contract.dto';

@ApiTags('Contracts')
@ApiBearerAuth('JWT')
export class ContractsController {
  constructor(private readonly contractsService: ContractsService) {}
}

@Controller('contracts')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class AdminContractsController {
  constructor(private readonly contractsService: ContractsService) {}

  @Get()
  @ApiOperation({ summary: 'Admin: list B2B contracts (PRD §20)' })
  @ApiQuery({ name: 'customerId', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiQuery({ name: 'agencyId', required: false, type: String })
  list(
    @Query('customerId') customerId?: string,
    @Query('status') status?: string,
    @Query('agencyId') agencyId?: string,
  ) {
    return this.contractsService.listForAdmin({ customerId, status, agencyId });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Admin: get contract detail (PRD §20)' })
  getById(@Param('id', ParseUUIDPipe) id: string) {
    return this.contractsService.getById(id);
  }

  @Post()
  @ApiOperation({ summary: 'Admin: create B2B contract (PRD §20)' })
  create(@Body() dto: CreateContractDto, @Req() req: any) {
    return this.contractsService.create(dto, req.user.id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Admin: update B2B contract (PRD §20)' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateContractDto,
    @Req() req: any,
  ) {
    return this.contractsService.update(id, dto, req.user.id);
  }
}

@Controller('corporate/contracts')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.CORPORATE)
export class CorporateContractsController {
  constructor(private readonly contractsService: ContractsService) {}

  @Get()
  @ApiOperation({ summary: 'Corporate: view contract, credit, and recent terms (PRD §20)' })
  getMyContract(@Req() req: any) {
    return this.contractsService.getCorporatePortalData(req.user.id);
  }
}
