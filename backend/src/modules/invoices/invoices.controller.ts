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
import { InvoiceStatus, InvoiceType, UserRole } from '@prisma/client';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import {
  GenerateBookingInvoiceDto,
  IssueInvoiceDto,
  RequestInvoiceApprovalDto,
} from './dto/invoice.dto';
import { InvoicesService } from './invoices.service';

@ApiTags('Invoices')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Get('customer/invoices')
  @Roles(UserRole.CUSTOMER)
  @ApiOperation({ summary: 'Customer invoice list and download access (PRD §16, §18)' })
  listCustomerInvoices(@Req() req: any) {
    return this.invoicesService.listForCustomer(req.user.id);
  }

  @Get('customer/invoices/:id/pdf')
  @Roles(UserRole.CUSTOMER)
  @ApiOperation({ summary: 'Customer invoice PDF download payload (PRD §16)' })
  async getCustomerInvoicePdf(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: any,
  ) {
    const pdf = await this.invoicesService.generatePdfForCustomer(id, req.user.id);
    return {
      fileName: pdf.fileName,
      contentBase64: pdf.buffer.toString('base64'),
    };
  }

  @Get('corporate/invoices')
  @Roles(UserRole.CORPORATE)
  @ApiOperation({ summary: 'Corporate outstanding invoices and credit usage (PRD §18, §20)' })
  listCorporateInvoices(@Req() req: any) {
    return this.invoicesService.listForCorporate(req.user.id);
  }

  @Get('corporate/invoices/:id/pdf')
  @Roles(UserRole.CORPORATE)
  @ApiOperation({ summary: 'Corporate invoice PDF download payload (PRD §16)' })
  async getCorporateInvoicePdf(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: any,
  ) {
    const pdf = await this.invoicesService.generatePdfForCorporate(id, req.user.id);
    return {
      fileName: pdf.fileName,
      contentBase64: pdf.buffer.toString('base64'),
    };
  }

  @Get('admin/invoices')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Admin invoice approval dashboard (PRD §16, §18)' })
  @ApiQuery({ name: 'status', required: false, enum: InvoiceStatus })
  @ApiQuery({ name: 'type', required: false, enum: InvoiceType })
  @ApiQuery({ name: 'customerId', required: false, type: String })
  @ApiQuery({ name: 'approvalRequired', required: false, type: Boolean })
  listAdminInvoices(
    @Query('status') status?: InvoiceStatus,
    @Query('type') type?: InvoiceType,
    @Query('customerId') customerId?: string,
    @Query('approvalRequired') approvalRequired?: string,
  ) {
    return this.invoicesService.listForAdmin({
      status,
      type,
      customerId,
      approvalRequired:
        approvalRequired == null ? undefined : approvalRequired === 'true',
    });
  }

  @Get('admin/invoices/:id')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Admin invoice detail (PRD §16)' })
  getAdminInvoice(@Param('id', ParseUUIDPipe) id: string) {
    return this.invoicesService.getForAdmin(id);
  }

  @Get('admin/invoices/:id/pdf')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Admin invoice PDF download payload (PRD §16)' })
  async getAdminInvoicePdf(@Param('id', ParseUUIDPipe) id: string) {
    const pdf = await this.invoicesService.generatePdfForAdmin(id);
    return {
      fileName: pdf.fileName,
      contentBase64: pdf.buffer.toString('base64'),
    };
  }

  @Post('admin/invoices/generate')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Generate booking invoice (PRD §16)' })
  generateBookingInvoice(@Body() dto: GenerateBookingInvoiceDto, @Req() req: any) {
    return this.invoicesService.generateForBooking(dto.bookingId, {
      taxRate: dto.taxRate,
      dueDate: dto.dueDate,
      issueImmediately: dto.issueImmediately,
      actorId: req.user.id,
    });
  }

  @Patch('admin/invoices/:id/request-approval')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Request approval for high-value invoice changes (PRD §18)' })
  requestApproval(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RequestInvoiceApprovalDto,
    @Req() req: any,
  ) {
    return this.invoicesService.requestApproval(id, req.user.id, dto.reason);
  }

  @Patch('admin/invoices/:id/approve')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Approve invoice for issue (PRD §18)' })
  approveInvoice(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    return this.invoicesService.approveInvoice(id, req.user.id);
  }

  @Patch('admin/invoices/:id/issue')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Issue and audit-lock invoice (PRD §16, §18)' })
  issueInvoice(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: IssueInvoiceDto,
    @Req() req: any,
  ) {
    return this.invoicesService.issueInvoice(id, req.user.id, dto.dueDate);
  }
}
