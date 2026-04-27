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
  getAll() {
    return this.supportService.findAll();
  }

  // ASSIGN
  @Patch(':id/assign')
  assign(@Param('id') id: string, @Req() req: any) {
    return this.supportService.assign(id, req.user.id);
  }

  // UPDATE STATUS
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateTicketDto,
    @Req() req: any,
  ) {
    return this.supportService.update(id, dto);
  }
}