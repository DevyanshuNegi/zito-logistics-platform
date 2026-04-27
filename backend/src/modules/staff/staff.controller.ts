import { Controller, Post, Body, Get, UseGuards } from '@nestjs/common';
import { StaffService } from './staff.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN', 'ADMIN')
@Controller('staff')
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  @Post()
  create(@Body() createStaffDto: any) {
    return this.staffService.createStaff('agencyId_placeholder', createStaffDto, 'adminId_placeholder');
  }

  @Get()
  findAll() {
    return this.staffService.listStaff('agencyId_placeholder');
  }
}
