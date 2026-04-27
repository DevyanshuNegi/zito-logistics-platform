import { Controller, Get, Post, Body, Patch, Param, UseGuards, UseInterceptors } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { IdempotencyInterceptor } from '../../common/interceptors/idempotency.interceptor';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @UseInterceptors(IdempotencyInterceptor)
  @Roles('CUSTOMER', 'ADMIN')
  @Post()
  create(@Body() createBookingDto: CreateBookingDto) {
    return this.bookingsService.create(createBookingDto);
  }

  @Roles('ADMIN', 'SUPER_ADMIN', 'AGENCY_STAFF')
  @Get()
  findAll() {
    return this.bookingsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.bookingsService.findOne(id);
  }

  @Roles('ADMIN', 'SUPER_ADMIN', 'AGENCY_STAFF', 'DRIVER')
  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body() updateBookingDto: UpdateBookingDto) {
    return this.bookingsService.updateStatus(id, updateBookingDto.status);
  }

  @Roles('ADMIN', 'CUSTOMER')
  @Patch(':id/cancel')
  cancel(@Param('id') id: string) {
    return this.bookingsService.cancel(id);
  }
}
