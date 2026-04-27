import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateBookingDto } from './dto/create-booking.dto';

@Injectable()
export class BookingsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createBookingDto: CreateBookingDto) {
    const reference = 'BKG-' + Math.floor(Math.random() * 1000000).toString();
    return this.prisma.booking.create({
      data: {
        ...createBookingDto,
        reference,
        status: 'CREATED',
      },
    });
  }

  async findAll() {
    return this.prisma.booking.findMany({
      include: { driver: true, vehicle: true, agency: true },
    });
  }

  async findOne(id: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: { driver: true, vehicle: true, agency: true },
    });
    if (!booking) throw new NotFoundException(`Booking ${id} not found`);
    return booking;
  }

  async updateStatus(id: string, status: any) {
    await this.findOne(id);
    return this.prisma.booking.update({
      where: { id },
      data: { status },
    });
  }

  async cancel(id: string) {
    await this.findOne(id);
    return this.prisma.booking.update({
      where: { id },
      data: { status: 'CANCELLED' as any },
    });
  }
}
