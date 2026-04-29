import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { StaffService } from './staff.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CreateStaffDto } from './dto/create-staff.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN', 'ADMIN')
@Controller('staff')
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  @Post()
  create(@Req() req: any, @Body() createStaffDto: CreateStaffDto) {
    const agencyId = req.user.agencyId ?? createStaffDto.agencyId;
    if (!agencyId) {
      throw new BadRequestException(
        'agencyId is required when the current admin is not scoped to an agency',
      );
    }

    return this.staffService.createStaff(
      agencyId,
      {
        userId: createStaffDto.userId,
        role: createStaffDto.role,
      },
      req.user.id,
    );
  }

  @Get()
  findAll(
    @Req() req: any,
    @Query('agencyId') agencyId?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    const scopedAgencyId = req.user.agencyId ?? agencyId;
    if (!scopedAgencyId) {
      throw new BadRequestException(
        'agencyId is required when the current admin is not scoped to an agency',
      );
    }

    return this.staffService.listStaff(
      scopedAgencyId,
      Number(page),
      Math.min(Number(limit), 100),
    );
  }
}
