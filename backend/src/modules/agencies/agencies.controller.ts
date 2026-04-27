import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { AgenciesService } from './agencies.service';
import { CreateAgencyDto } from './dto/create-agency.dto';
import { UpdateAgencyDto } from './dto/update-agency.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN')
@Controller('agencies')
export class AgenciesController {
  constructor(private readonly agenciesService: AgenciesService) {}

  @Post()
  create(@Body() createAgencyDto: CreateAgencyDto) {
    return this.agenciesService.create(createAgencyDto);
  }

  @Roles('SUPER_ADMIN', 'ADMIN', 'AGENCY_STAFF')
  @Get()
  findAll() {
    return this.agenciesService.findAll();
  }

  @Roles('SUPER_ADMIN', 'ADMIN', 'AGENCY_STAFF')
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.agenciesService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateAgencyDto: UpdateAgencyDto) {
    return this.agenciesService.update(id, updateAgencyDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.agenciesService.remove(id);
  }
}
