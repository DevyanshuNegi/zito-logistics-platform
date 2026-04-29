import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';

// PRD §25, §36, §37 — Support Ticket System

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  OPEN: ['IN_PROGRESS'],
  IN_PROGRESS: ['RESOLVED', 'ESCALATED'],
  ESCALATED: ['IN_PROGRESS', 'RESOLVED'],
  RESOLVED: ['CLOSED'],
  CLOSED: [],
};

@Injectable()
export class SupportService {
  constructor(private prisma: PrismaService) {}

  // PRD §25 — Create support ticket
  async create(userId: string, dto: CreateTicketDto) {
    return this.prisma.supportTicket.create({
      data: {
        raisedBy: userId,
        bookingId: dto.bookingId,
        category: dto.category,
        priority: dto.priority ?? 'MEDIUM',
        description: dto.message,
        status: 'OPEN',
      },
    });
  }

  // PRD §25 — Customer: get own tickets
  async findMyTickets(userId: string) {
    return this.prisma.supportTicket.findMany({
      where: { raisedBy: userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  // PRD §36 — Admin/Staff: get all tickets
  async findAll() {
    return this.prisma.supportTicket.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  // PRD §36 — Assign ticket to staff
  async assign(ticketId: string, staffId: string) {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket) throw new NotFoundException('Ticket not found');

    if (ticket.status !== 'OPEN') {
      throw new BadRequestException(
        `Cannot assign ticket in status ${ticket.status}`,
      );
    }

    return this.prisma.supportTicket.update({
      where: { id: ticketId },
      data: {
        handlerId: staffId,
        status: 'IN_PROGRESS',
      },
    });
  }

  // PRD §37 — Update ticket lifecycle
  async update(id: string, dto: UpdateTicketDto) {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id },
    });

    if (!ticket) throw new NotFoundException('Ticket not found');

    if (dto.status) {
      const allowed = ALLOWED_TRANSITIONS[ticket.status] || [];

      if (!allowed.includes(dto.status)) {
        throw new BadRequestException(
          `Invalid transition from ${ticket.status} to ${dto.status}`,
        );
      }
    }

    const isClosing =
      dto.status === 'RESOLVED' || dto.status === 'CLOSED';

    return this.prisma.supportTicket.update({
      where: { id },
      data: {
        ...(dto.status && { status: dto.status as any }),
        ...(dto.resolution && { resolution: dto.resolution }),
        ...(isClosing && { closedAt: new Date() }),
      },
    });
  }

  // PRD §36 — Escalation flow
  async escalate(id: string) {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id },
    });

    if (!ticket) throw new NotFoundException('Ticket not found');

    if (ticket.status !== 'IN_PROGRESS') {
      throw new BadRequestException(
        'Only IN_PROGRESS tickets can be escalated',
      );
    }

    return this.prisma.supportTicket.update({
      where: { id },
      data: {
        status: 'ESCALATED',
        escalationLevel: ticket.escalationLevel + 1,
        escalatedAt: new Date(),
      },
    });
  }
}