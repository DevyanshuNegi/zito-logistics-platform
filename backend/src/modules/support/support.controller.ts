import { Controller, Post, Body, Get, Param, Patch, UseGuards, Req } from '@nestjs/common';
import { SupportService } from './support.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('support')
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  @Post()
  create(@Body() createTicketDto: any, @Req() req: any) {
    const user = req.user;
    createTicketDto.customerId = user.id; // ensure correct name
    return this.supportService.create(createTicketDto);
  }

  @Roles('ADMIN', 'SUPER_ADMIN', 'SUPPORT_STAFF')
  @Get()
  findAll() {
    return this.supportService.findAll();
  }

  @Roles('ADMIN', 'SUPER_ADMIN', 'SUPPORT_STAFF')
  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body('status') status: string) {
    return this.supportService.resolveTicket(id);
  }
}

