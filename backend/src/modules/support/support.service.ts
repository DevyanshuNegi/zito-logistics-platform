import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTicketDto } from './dto/create-ticket.dto';

@Injectable()
export class SupportService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createTicketDto: CreateTicketDto, customerId: string) {
    return this.prisma.supportTicket.create({
      data: {
        ...createTicketDto,
        customerId,
        status: 'OPEN',
      },
    });
  }

  async findAll() {
    return this.prisma.supportTicket.findMany({
      include: { customer: true, assignedTo: true, booking: true },
    });
  }

  async updateStatus(id: string, status: any) {
    const ticket = await this.prisma.supportTicket.findUnique({ where: { id } });
    if (!ticket) throw new NotFoundException('Ticket not found');

    return this.prisma.supportTicket.update({
      where: { id },
      data: { status },
    });
  }
}
