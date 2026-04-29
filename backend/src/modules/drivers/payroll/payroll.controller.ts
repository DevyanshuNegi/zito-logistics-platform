import {
  Controller, Get, Post, Patch, Body, Param,
  Query, UseGuards, Request, ParseUUIDPipe, HttpCode, HttpStatus,
} from '@nestjs/common';
import { PayrollService } from './payroll.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';

@Controller('driver/payroll')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('DRIVER')
export class DriverPayrollController {
  constructor(private readonly payrollService: PayrollService) {}

  @Get()
  list(@Request() req, @Query('page') page = '1', @Query('limit') limit = '20') {
    return this.payrollService.listForDriver(req.user.driverId, +page, +limit);
  }

  @Get('summary')
  summary(@Request() req) {
    return this.payrollService.getEarningsSummary(req.user.driverId);
  }

  @Get(':id')
  getOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.payrollService.getPayroll(id);
  }
}

@Controller('admin/payroll')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'SUPER_ADMIN')
export class AdminPayrollController {
  constructor(private readonly payrollService: PayrollService) {}

  @Get()
  list(@Query('driverId') driverId?: string, @Query('status') status?: string, @Query('page') page = '1', @Query('limit') limit = '20') {
    return this.payrollService.listForAdmin({ driverId, status, page: +page, limit: +limit });
  }

  @Post('generate')
  @HttpCode(HttpStatus.CREATED)
  generate(@Body('driverId') driverId: string, @Body('periodStart') periodStart: string, @Body('periodEnd') periodEnd: string) {
    return this.payrollService.generatePayroll(driverId, new Date(periodStart), new Date(periodEnd));
  }

  @Patch(':id/approve')
  @HttpCode(HttpStatus.OK)
  approve(@Param('id', ParseUUIDPipe) id: string, @Request() req) {
    return this.payrollService.approvePayroll(id, req.user.id);
  }

  @Patch(':id/mark-paid')
  @HttpCode(HttpStatus.OK)
  markPaid(@Param('id', ParseUUIDPipe) id: string, @Body('transactionRef') transactionRef: string) {
    return this.payrollService.markPaid(id, transactionRef);
  }

  @Post('incentive')
  @HttpCode(HttpStatus.CREATED)
  addIncentive(@Body() body: { driverId: string; type: string; amount: number; reason?: string; bookingId?: string }) {
    return this.payrollService.addIncentive(body);
  }

  @Post('penalty')
  @HttpCode(HttpStatus.CREATED)
  addPenalty(@Body() body: { driverId: string; type: string; amount: number; reason: string; bookingId?: string }) {
    return this.payrollService.addPenalty(body);
  }
}