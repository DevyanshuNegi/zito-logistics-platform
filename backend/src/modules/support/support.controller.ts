import { Controller, Post, Body, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { SupportService } from './support.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('support')
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  @Roles('CUSTOMER')
  @Post()
  create(@CurrentUser() user: any, @Body() createTicketDto: CreateTicketDto) {
    return this.supportService.create(createTicketDto, user.id);
  }

  @Roles('ADMIN', 'SUPER_ADMIN', 'AGENCY_STAFF')
  @Get()
  findAll() {
    return this.supportService.findAll();
  }

  @Roles('ADMIN', 'SUPER_ADMIN', 'AGENCY_STAFF')
  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body('status') status: string) {
    return this.supportService.updateStatus(id, status);
  }
}

