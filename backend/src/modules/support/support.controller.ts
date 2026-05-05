import {
  Controller,
  Post,
  Body,
  Get,
  Patch,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import { SupportService } from './support.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('support')
@UseGuards(JwtAuthGuard)
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  // CREATE
  @Post()
  create(@Req() req: any, @Body() dto: CreateTicketDto) {
    return this.supportService.create(req.user.id, dto);
  }

  // CUSTOMER VIEW
  @Get('my')
  getMy(@Req() req: any) {
    return this.supportService.findMyTickets(req.user.id);
  }

  // ADMIN VIEW
  @Get()
  @UseGuards(RolesGuard)
  @Roles('AGENCY_STAFF', 'ADMIN', 'SUPER_ADMIN')
  getAll() {
    return this.supportService.findAll();
  }

  // ASSIGN
  @Patch(':id/assign')
  @UseGuards(RolesGuard)
  @Roles('AGENCY_STAFF', 'ADMIN', 'SUPER_ADMIN')
  assign(@Param('id') id: string, @Req() req: any) {
    return this.supportService.assign(id, req.user.id);
  }

  // UPDATE STATUS
  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('AGENCY_STAFF', 'ADMIN', 'SUPER_ADMIN')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateTicketDto,
    @Req() req: any,
  ) {
    return this.supportService.update(id, dto);
  }
}
