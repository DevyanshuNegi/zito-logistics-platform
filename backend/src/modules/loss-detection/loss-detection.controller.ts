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
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { LossDetectionService } from './loss-detection.service';
import {
  CreateLossReportDto,
  DetectMismatchDto,
  DetectStaleDto,
  LossReportQueryDto,
  ReviewLossReportDto,
} from './dto/loss-detection.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('loss-detection')
export class LossDetectionController {
  constructor(private readonly lossDetectionService: LossDetectionService) {}

  @Roles('SUPER_ADMIN', 'ADMIN', 'AGENCY_STAFF', 'WAREHOUSE_PARTNER')
  @Get()
  list(@Query() query: LossReportQueryDto) {
    return this.lossDetectionService.listReports(query);
  }

  @Roles('SUPER_ADMIN', 'ADMIN', 'AGENCY_STAFF', 'WAREHOUSE_PARTNER')
  @Get(':id')
  getOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.lossDetectionService.getReport(id);
  }

  @Roles('SUPER_ADMIN', 'ADMIN', 'AGENCY_STAFF', 'WAREHOUSE_PARTNER')
  @Post('mismatch')
  detectMismatch(@Body() body: DetectMismatchDto, @Req() req: any) {
    return this.lossDetectionService.detectMismatch(
      body.bookingId,
      req.user.id,
      body.expectedCount,
      body.scannedCount,
      body.checkpoint,
    );
  }

  @Roles('SUPER_ADMIN', 'ADMIN', 'AGENCY_STAFF', 'WAREHOUSE_PARTNER')
  @Post('stale-check')
  detectStale(@Body() body: DetectStaleDto) {
    return this.lossDetectionService.detectStale(body.slaHours);
  }

  @Roles('SUPER_ADMIN', 'ADMIN', 'AGENCY_STAFF', 'WAREHOUSE_PARTNER')
  @Post()
  create(@Body() body: CreateLossReportDto, @Req() req: any) {
    return this.lossDetectionService.createReport({
      ...body,
      reportedBy: req.user.id,
    });
  }

  @Roles('SUPER_ADMIN', 'ADMIN')
  @Patch(':id/approve')
  approve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ReviewLossReportDto,
    @Req() req: any,
  ) {
    return this.lossDetectionService.requireApproval(id, req.user.id, body.notes);
  }
}
