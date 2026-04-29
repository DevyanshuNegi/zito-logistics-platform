import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class StaffPerformanceService {
  constructor(private readonly prisma: PrismaService) {}

  async listPerformance(agencyId?: string) {
    const staffMembers = await this.prisma.staff.findMany({
      where: {
        isActive: true,
        ...(agencyId && { agencyId }),
      },
      include: {
        agency: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const userIds = [...new Set(staffMembers.map((staff) => staff.userId))];
    const users =
      userIds.length > 0
        ? await this.prisma.user.findMany({
            where: { id: { in: userIds } },
            select: {
              id: true,
              fullName: true,
              email: true,
              phone: true,
              role: true,
              status: true,
            },
          })
        : [];
    const usersById = new Map(users.map((user) => [user.id, user]));

    const items = await Promise.all(
      staffMembers.map(async (staff) => {
        const user = usersById.get(staff.userId);
        const [bookingLogs, approvalLogs, tickets] = await Promise.all([
          this.prisma.auditLog.findMany({
            where: {
              userId: staff.userId,
              entityType: 'BOOKING',
            },
            select: {
              entityId: true,
              createdAt: true,
            },
          }),
          this.prisma.auditLog.findMany({
            where: {
              userId: staff.userId,
              entityType: 'APPROVAL_REQUEST',
            },
            select: {
              id: true,
              createdAt: true,
            },
          }),
          this.prisma.supportTicket.findMany({
            where: {
              handlerId: staff.userId,
            },
            select: {
              id: true,
              status: true,
              createdAt: true,
              closedAt: true,
              updatedAt: true,
            },
          }),
        ]);

        const bookingTouches = new Set(bookingLogs.map((log) => log.entityId)).size;
        const approvalsHandled = approvalLogs.length;
        const resolvedTickets = tickets.filter((ticket) =>
          ['RESOLVED', 'CLOSED'].includes(ticket.status),
        );
        const openTickets = tickets.filter(
          (ticket) => !['RESOLVED', 'CLOSED'].includes(ticket.status),
        );
        const avgResolutionHours =
          resolvedTickets.length > 0
            ? Number(
                (
                  resolvedTickets.reduce((sum, ticket) => {
                    const closedAt = ticket.closedAt ?? ticket.updatedAt;
                    return sum + (closedAt.getTime() - ticket.createdAt.getTime()) / (1000 * 60 * 60);
                  }, 0) / resolvedTickets.length
                ).toFixed(2),
              )
            : 0;

        const lastActivityAt = [
          ...bookingLogs.map((log) => log.createdAt),
          ...approvalLogs.map((log) => log.createdAt),
          ...tickets.map((ticket) => ticket.updatedAt),
        ].sort((left, right) => right.getTime() - left.getTime())[0] ?? null;

        return {
          staffId: staff.id,
          userId: staff.userId,
          fullName: user?.fullName ?? user?.email ?? user?.phone ?? staff.userId,
          role: staff.role,
          accountRole: user?.role ?? 'AGENCY_STAFF',
          accountStatus: user?.status ?? 'ACTIVE',
          agency: staff.agency,
          bookingsHandled: bookingTouches,
          ticketsHandled: tickets.length,
          ticketsResolved: resolvedTickets.length,
          openTickets: openTickets.length,
          approvalActions: approvalsHandled,
          averageResolutionHours: avgResolutionHours,
          lastActivityAt,
        };
      }),
    );

    const summary = {
      totalStaff: items.length,
      bookingTouches: items.reduce((sum, item) => sum + item.bookingsHandled, 0),
      ticketsHandled: items.reduce((sum, item) => sum + item.ticketsHandled, 0),
      ticketsResolved: items.reduce((sum, item) => sum + item.ticketsResolved, 0),
      approvalActions: items.reduce((sum, item) => sum + item.approvalActions, 0),
      averageResolutionHours:
        items.length > 0
          ? Number(
              (
                items.reduce((sum, item) => sum + item.averageResolutionHours, 0) / items.length
              ).toFixed(2),
            )
          : 0,
    };

    return {
      items,
      total: items.length,
      summary,
    };
  }

  async getPerformance(userId: string) {
    const dashboard = await this.listPerformance();
    const staffMember = dashboard.items.find((item) => item.userId === userId);

    if (!staffMember) {
      return null;
    }

    const tickets = await this.prisma.supportTicket.findMany({
      where: { handlerId: userId },
      orderBy: { updatedAt: 'desc' },
      take: 20,
      include: {
        booking: {
          select: {
            id: true,
            reference: true,
          },
        },
      },
    });

    return {
      ...staffMember,
      recentTickets: tickets,
    };
  }
}
