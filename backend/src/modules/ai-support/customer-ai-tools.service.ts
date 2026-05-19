import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ChatAiSupportDto } from './dto/chat-ai-support.dto';
import type { CustomerAiContextSummary } from './types';

@Injectable()
export class CustomerAiToolsService {
  constructor(private readonly prisma: PrismaService) {}

  async buildContext(
    userId: string,
    dto: ChatAiSupportDto,
  ): Promise<CustomerAiContextSummary> {
    const [selectedBooking, recentBookings, recentInvoices, recentTickets, vehicleCount, driverCount, vehicles] =
      await Promise.all([
        dto.bookingId
          ? this.prisma.booking.findFirst({
              where: { id: dto.bookingId, customerId: userId },
              include: {
                stops: {
                  select: {
                    sequence: true,
                    address: true,
                    stopType: true,
                  },
                  orderBy: { sequence: 'asc' },
                },
                payments: {
                  select: {
                    status: true,
                    reference: true,
                    amount: true,
                    method: true,
                  },
                  orderBy: { createdAt: 'desc' },
                  take: 1,
                },
                invoice: {
                  select: {
                    number: true,
                    status: true,
                    totalAmount: true,
                    paidAmount: true,
                  },
                },
              },
            })
          : Promise.resolve(null),
        this.prisma.booking.findMany({
          where: { customerId: userId },
          select: {
            id: true,
            reference: true,
            status: true,
            serviceType: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 5,
        }),
        this.prisma.invoice.findMany({
          where: { customerId: userId },
          select: {
            id: true,
            number: true,
            status: true,
            totalAmount: true,
            paidAmount: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 5,
        }),
        this.prisma.supportTicket.findMany({
          where: { raisedBy: userId },
          select: {
            id: true,
            category: true,
            status: true,
            priority: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 5,
        }),
        this.prisma.vehicle.count({
          where: { ownerUserId: userId },
        }),
        this.prisma.driver.count({
          where: { ownerUserId: userId },
        }),
        this.prisma.vehicle.findMany({
          where: { ownerUserId: userId },
          select: {
            id: true,
            plateNumber: true,
            type: true,
            verificationStatus: true,
            status: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 5,
        }),
      ]);

    return {
      selectedBooking: selectedBooking
        ? {
            id: selectedBooking.id,
            reference: selectedBooking.reference,
            status: selectedBooking.status,
            serviceType: selectedBooking.serviceType,
            totalPrice: selectedBooking.totalPrice,
            stops: selectedBooking.stops,
            latestPayment: selectedBooking.payments[0] ?? null,
            invoice: selectedBooking.invoice,
          }
        : null,
      recentBookings,
      recentInvoices,
      recentTickets,
      ownedFleet: {
        vehicleCount,
        driverCount,
        vehicles,
      },
    };
  }
}
