import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { WaybillService } from './waybill.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  CreateWaybillDto,
  UpdateWaybillStatusDto,
  WaybillQueryDto,
} from './dto/waybill.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('waybill')
export class WaybillController {
  constructor(private readonly waybillService: WaybillService) {}

  @Roles('SUPER_ADMIN', 'ADMIN', 'AGENCY_STAFF')
  @Get()
  list(@Query() query: WaybillQueryDto) {
    return this.waybillService.listWaybills(query);
  }

  @Roles('SUPER_ADMIN', 'ADMIN', 'AGENCY_STAFF')
  @Post()
  create(@Body() data: CreateWaybillDto) {
    return this.waybillService.createWaybill(data);
  }

  @Roles('SUPER_ADMIN', 'ADMIN', 'AGENCY_STAFF', 'DRIVER', 'CUSTOMER')
  @Get(':id/pdf')
  async generatePdf(
    @Param('id', ParseUUIDPipe) id: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const pdf = await this.waybillService.generatePdf(id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${pdf.fileName}"`,
    );
    return new StreamableFile(pdf.buffer);
  }

  @Roles('SUPER_ADMIN', 'ADMIN', 'AGENCY_STAFF', 'DRIVER', 'CUSTOMER')
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.waybillService.findOne(id);
  }

  @Roles('SUPER_ADMIN', 'ADMIN', 'AGENCY_STAFF')
  @Patch(':id/lock')
  lock(@Param('id', ParseUUIDPipe) id: string) {
    return this.waybillService.lockWaybill(id);
  }

  @Roles('SUPER_ADMIN', 'ADMIN', 'AGENCY_STAFF', 'DRIVER')
  @Patch(':id/status')
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateWaybillStatusDto,
  ) {
    return this.waybillService.updateStatus(id, body.status);
  }
}
