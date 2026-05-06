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

type SupportActor = {
  id: string;
  role: string;
};

function isPrivilegedSupportRole(role: string) {
  return ['AGENCY_STAFF', 'ADMIN', 'SUPER_ADMIN'].includes(role);
}

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
        sourceContextType: dto.sourceContextType,
        sourceContextId: dto.sourceContextId,
        autobotSummary: dto.autobotSummary,
        autobotArticle: dto.autobotArticle,
        autobotConfidence: dto.autobotConfidence,
        autobotQuickAction: dto.autobotQuickAction,
        autobotEscalationDesk: dto.autobotEscalationDesk,
        autobotSuggestedReply: dto.autobotSuggestedReply,
        status: 'OPEN',
        messages: {
          create: [
            ...(dto.autobotSummary
              ? [
                  {
                    actorType: 'AUTOBOT',
                    message: dto.autobotSummary,
                    isInternal: false,
                  },
                ]
              : []),
            {
              authorId: userId,
              actorType: 'CUSTOMER',
              message: dto.message,
              isInternal: false,
            },
          ],
        },
      },
    });
  }

  // PRD §25 — Customer: get own tickets
  async findMyTickets(userId: string) {
    return this.prisma.supportTicket.findMany({
      where: { raisedBy: userId },
      include: {
        messages: {
          where: { isInternal: false },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // PRD §36 — Admin/Staff: get all tickets
  async findAll() {
    return this.prisma.supportTicket.findMany({
      include: {
        booking: {
          select: {
            id: true,
            reference: true,
            status: true,
          },
        },
        raiser: {
          select: {
            fullName: true,
            email: true,
            phone: true,
            role: true,
          },
        },
        handler: {
          select: {
            fullName: true,
            email: true,
            phone: true,
          },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, actor: SupportActor) {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id },
      include: {
        booking: {
          select: {
            id: true,
            reference: true,
            status: true,
          },
        },
        raiser: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
            role: true,
          },
        },
        handler: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
          },
        },
        messages: {
          include: {
            author: {
              select: {
                id: true,
                fullName: true,
                email: true,
                phone: true,
                role: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    if (!isPrivilegedSupportRole(actor.role) && ticket.raisedBy !== actor.id) {
      throw new NotFoundException('Ticket not found');
    }

    return {
      ...ticket,
      messages: isPrivilegedSupportRole(actor.role)
        ? ticket.messages
        : ticket.messages.filter((message) => !message.isInternal),
    };
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

  async addMessage(ticketId: string, actor: SupportActor, message: string, isInternal = false) {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    const privileged = isPrivilegedSupportRole(actor.role);
    if (!privileged && ticket.raisedBy !== actor.id) {
      throw new NotFoundException('Ticket not found');
    }

    if (!privileged && isInternal) {
      throw new BadRequestException('Only staff can add internal notes');
    }

    if (ticket.status === 'CLOSED') {
      throw new BadRequestException('Closed tickets cannot receive new messages');
    }

    const nextStatus =
      privileged && ticket.status === 'OPEN'
        ? 'IN_PROGRESS'
        : !privileged && ticket.status === 'RESOLVED'
          ? 'IN_PROGRESS'
          : undefined;

    const closedAt =
      nextStatus === 'IN_PROGRESS' ? null : ticket.closedAt;

    return this.prisma.supportTicket.update({
      where: { id: ticketId },
      data: {
        ...(nextStatus ? { status: nextStatus as any } : {}),
        ...(privileged && !ticket.handlerId ? { handlerId: actor.id } : {}),
        ...(closedAt === null ? { closedAt: null } : {}),
        messages: {
          create: {
            authorId: actor.id,
            actorType: privileged ? 'STAFF' : 'CUSTOMER',
            message,
            isInternal,
          },
        },
      },
      include: {
        booking: {
          select: {
            id: true,
            reference: true,
            status: true,
          },
        },
        raiser: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
            role: true,
          },
        },
        handler: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
          },
        },
        messages: {
          include: {
            author: {
              select: {
                id: true,
                fullName: true,
                email: true,
                phone: true,
                role: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
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
