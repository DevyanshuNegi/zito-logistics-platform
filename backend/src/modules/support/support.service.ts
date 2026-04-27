import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SupportService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createTicketDto: any) {
    return this.prisma.supportTicket.create({
      data: {
        raisedBy: createTicketDto.customerId,
        category: createTicketDto.subject || 'GENERAL',
        description: createTicketDto.message,
        status: 'OPEN',
      },
    });
  }

  async findAll() {
    return this.prisma.supportTicket.findMany({
      include: { raiser: true, handler: true, booking: true },
    });
  }

  async resolveTicket(id: string) {
    return this.prisma.supportTicket.update({
      where: { id },
      data: { status: 'RESOLVED', closedAt: new Date() },
    });
  }
}

