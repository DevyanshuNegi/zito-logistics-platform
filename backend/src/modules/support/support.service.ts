import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';

// PRD §25, §36, §37 — Support Ticket System
@Injectable()
export class SupportService {
  constructor(private prisma: PrismaService) {}

  // PRD §25 — Create support ticket
  async create(userId: string, dto: CreateTicketDto) {
    return this.prisma.supportTicket.create({
      data: {
        raisedBy:    userId,
        bookingId:   dto.bookingId,
        category:    dto.category,
        priority:    dto.priority ?? 'MEDIUM',
        description: dto.message,
        status:      'OPEN',
      },
    });
  }

  // PRD §25 — Customer: get own tickets
  async findMyTickets(userId: string) {
    return this.prisma.supportTicket.findMany({
      where:   { raisedBy: userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  // PRD §36 — Admin/Staff: get all tickets
  async findAll() {
    return this.prisma.supportTicket.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  // PRD §36 — Assign ticket to staff handler
  async assign(ticketId: string, staffId: string) {
    return this.prisma.supportTicket.update({
      where: { id: ticketId },
      data: {
        handlerId: staffId,
        status:    'IN_PROGRESS',
      },
    });
  }

  // PRD §37 — Update ticket status and resolution
  // Schema fields: status, resolution, closedAt, escalationLevel, escalatedAt
  // No `rating`, `feedback`, `resolvedBy` in schema — removed
  async update(id: string, dto: UpdateTicketDto) {
    const ticket = await this.prisma.supportTicket.findUnique({ where: { id } });
    if (!ticket) throw new NotFoundException('Ticket not found');

    const isClosing = dto.status === 'RESOLVED' || dto.status === 'CLOSED';

    return this.prisma.supportTicket.update({
      where: { id },
      data: {
        ...(dto.status     && { status: dto.status as any }),
        ...(dto.resolution && { resolution: dto.resolution }),
        ...(isClosing      && { closedAt: new Date() }),
      },
    });
  }

  // PRD §37 — Escalate ticket
  async escalate(id: string) {
    const ticket = await this.prisma.supportTicket.findUnique({ where: { id } });
    if (!ticket) throw new NotFoundException('Ticket not found');

    return this.prisma.supportTicket.update({
      where: { id },
      data: {
        status:          'ESCALATED',
        escalationLevel: ticket.escalationLevel + 1,
        escalatedAt:     new Date(),
      },
    });
  }
}