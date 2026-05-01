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
  Res,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { UserRole } from '@prisma/client';
import { WaybillService } from './waybill.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  CreateWaybillDto,
  UpdateWaybillStatusDto,
  WaybillQueryDto,
} from './dto/waybill.dto';

function buildWaybillAccessContext(req: any) {
  return {
    viewerRole: req.user.activeRole ?? req.user.role,
    viewerUserId: req.user.id,
    viewerAgencyId: req.user.agencyId,
    viewerDriverId: req.user.driverId,
  };
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class WaybillController {
  constructor(private readonly waybillService: WaybillService) {}

  @Roles('SUPER_ADMIN', 'ADMIN', 'AGENCY_STAFF')
  @Get('waybill')
  list(@Query() query: WaybillQueryDto, @Req() req: any) {
    return this.waybillService.listWaybills(query, buildWaybillAccessContext(req));
  }

  @Roles('SUPER_ADMIN', 'ADMIN', 'AGENCY_STAFF')
  @Post('waybill')
  create(@Body() data: CreateWaybillDto, @Req() req: any) {
    return this.waybillService.createWaybill(data, buildWaybillAccessContext(req));
  }

  @Roles('SUPER_ADMIN', 'ADMIN', 'AGENCY_STAFF', 'DRIVER', 'CUSTOMER')
  @Get('waybill/:id/pdf')
  async generatePdf(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    const pdf = await this.waybillService.generatePdf(
      id,
      buildWaybillAccessContext(req),
    );
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${pdf.fileName}"`,
    );
    return new StreamableFile(pdf.buffer);
  }

  @Roles('SUPER_ADMIN', 'ADMIN', 'AGENCY_STAFF', 'DRIVER', 'CUSTOMER')
  @Get('waybill/:id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    return this.waybillService.findOne(id, buildWaybillAccessContext(req));
  }

  @Roles('SUPER_ADMIN', 'ADMIN', 'AGENCY_STAFF')
  @Patch('waybill/:id/lock')
  lock(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    return this.waybillService.lockWaybill(id, buildWaybillAccessContext(req));
  }

  @Roles('SUPER_ADMIN', 'ADMIN', 'AGENCY_STAFF', 'DRIVER')
  @Patch('waybill/:id/status')
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateWaybillStatusDto,
    @Req() req: any,
  ) {
    return this.waybillService.updateStatus(
      id,
      body.status,
      buildWaybillAccessContext(req),
    );
  }

  @Get('courier-company/waybills')
  @Roles(UserRole.COURIER_COMPANY)
  listCourierCompanyWaybills(@Query() query: WaybillQueryDto, @Req() req: any) {
    return this.waybillService.listWaybills(query, buildWaybillAccessContext(req));
  }

  @Post('courier-company/waybills')
  @Roles(UserRole.COURIER_COMPANY)
  createCourierCompanyWaybill(@Body() data: CreateWaybillDto, @Req() req: any) {
    return this.waybillService.createWaybill(data, buildWaybillAccessContext(req));
  }

  @Get('courier-company/waybills/:id')
  @Roles(UserRole.COURIER_COMPANY)
  findCourierCompanyWaybill(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: any,
  ) {
    return this.waybillService.findOne(id, buildWaybillAccessContext(req));
  }

  @Get('courier-company/waybills/:id/pdf')
  @Roles(UserRole.COURIER_COMPANY)
  async getCourierCompanyWaybillPdf(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: any,
  ) {
    const pdf = await this.waybillService.generatePdf(
      id,
      buildWaybillAccessContext(req),
    );
    return {
      fileName: pdf.fileName,
      contentBase64: pdf.buffer.toString('base64'),
    };
  }

  @Patch('courier-company/waybills/:id/status')
  @Roles(UserRole.COURIER_COMPANY)
  updateCourierCompanyWaybillStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateWaybillStatusDto,
    @Req() req: any,
  ) {
    return this.waybillService.updateStatus(
      id,
      body.status,
      buildWaybillAccessContext(req),
    );
  }
}
