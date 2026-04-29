import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { BillingService } from './billing.service';
import {
  ConsolidateInvoiceDto,
  GenerateWarehouseInvoiceDto,
} from './dto/billing.dto';
import { InterAgencyBillDto } from './dto/inter-agency-bill.dto';

@ApiTags('Billing')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
@Controller('admin/billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Post('warehouse-invoice')
  @ApiOperation({ summary: 'Generate warehouse billing invoice (PRD §17)' })
  generateWarehouseInvoice(@Body() dto: GenerateWarehouseInvoiceDto, @Req() req: any) {
    return this.billingService.generateWarehouseInvoice(dto, req.user.id);
  }

  @Post('consolidate')
  @ApiOperation({ summary: 'Generate combined corporate invoice (PRD §18)' })
  consolidate(@Body() dto: ConsolidateInvoiceDto, @Req() req: any) {
    return this.billingService.consolidate(dto, req.user.id);
  }

  @Get('inter-agency')
  @ApiOperation({ summary: 'List generated inter-agency billing settlements (PRD §49)' })
  listInterAgencyBills() {
    return this.billingService.listInterAgencyBills();
  }

  @Post('inter-agency')
  @ApiOperation({ summary: 'Generate inter-agency billing settlement for a cross-border shipment (PRD §49)' })
  interAgencyBill(@Body() dto: InterAgencyBillDto, @Req() req: any) {
    return this.billingService.interAgencyBill(dto, req.user.id);
  }
}
