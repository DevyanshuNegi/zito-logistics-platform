import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AccountStatus,
  PaymentMethod,
  Prisma,
  ServiceType,
  UserRole,
  VehicleType,
} from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { BookingsService } from '../bookings/bookings.service';
import { PaymentsService } from '../payments/payments.service';
import { SmsService } from '../notifications/channels/sms.service';

type UssdSessionStep =
  | 'ROOT'
  | 'BOOK_SERVICE'
  | 'BOOK_PICKUP'
  | 'BOOK_DELIVERY'
  | 'BOOK_CARGO'
  | 'BOOK_CONFIRM'
  | 'TRACK_REFERENCE'
  | 'PAY_REFERENCE'
  | 'PAY_CONFIRM';

type UssdSessionRecord = {
  sessionId: string;
  phoneNumber: string;
  serviceCode: string | null;
  step: UssdSessionStep;
  data: Record<string, string>;
  updatedAt: string;
};

@Injectable()
export class UssdService {
  private readonly sessionPrefix = 'ussd-session:';
  private readonly sessionTtlMs = 30 * 60 * 1000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly bookingsService: BookingsService,
    private readonly paymentsService: PaymentsService,
    private readonly smsService: SmsService,
  ) {}

  async handle(input: {
    sessionId: string;
    serviceCode?: string;
    phoneNumber: string;
    text?: string;
  }) {
    const session = await this.getSession(input);
    const latestInput = this.latestSegment(input.text);

    switch (session.step) {
      case 'ROOT':
        return this.handleRoot(session, latestInput);
      case 'BOOK_SERVICE':
        return this.handleBookService(session, latestInput);
      case 'BOOK_PICKUP':
        return this.handleBookPickup(session, latestInput);
      case 'BOOK_DELIVERY':
        return this.handleBookDelivery(session, latestInput);
      case 'BOOK_CARGO':
        return this.handleBookCargo(session, latestInput);
      case 'BOOK_CONFIRM':
        return this.handleBookConfirm(session, latestInput);
      case 'TRACK_REFERENCE':
        return this.handleTrackReference(session, latestInput);
      case 'PAY_REFERENCE':
        return this.handlePayReference(session, latestInput);
      case 'PAY_CONFIRM':
        return this.handlePayConfirm(session, latestInput);
      default:
        await this.clearSession(session.sessionId);
        return this.end('Session expired. Please try again.');
    }
  }

  private async handleRoot(session: UssdSessionRecord, latestInput: string | null) {
    if (!latestInput) {
      await this.saveSession({
        ...session,
        step: 'ROOT',
        data: {},
      });
      return this.con('Welcome to ZITO\n1. Book parcel\n2. Track booking\n3. Pay booking');
    }

    if (latestInput === '1') {
      await this.saveSession({
        ...session,
        step: 'BOOK_SERVICE',
        data: {},
      });
      return this.con('Select service\n1. Courier\n2. Partial load\n3. Full truck');
    }

    if (latestInput === '2') {
      await this.saveSession({
        ...session,
        step: 'TRACK_REFERENCE',
        data: {},
      });
      return this.con('Enter booking reference');
    }

    if (latestInput === '3') {
      await this.saveSession({
        ...session,
        step: 'PAY_REFERENCE',
        data: {},
      });
      return this.con('Enter booking reference');
    }

    return this.con('Invalid choice\n1. Book parcel\n2. Track booking\n3. Pay booking');
  }

  private async handleBookService(
    session: UssdSessionRecord,
    latestInput: string | null,
  ) {
    const mapping = this.mapServiceSelection(latestInput);
    if (!mapping) {
      return this.con('Select service\n1. Courier\n2. Partial load\n3. Full truck');
    }

    await this.saveSession({
      ...session,
      step: 'BOOK_PICKUP',
      data: {
        serviceType: mapping.serviceType,
        vehicleType: mapping.vehicleType,
        serviceLabel: mapping.label,
      },
    });
    return this.con('Enter pickup address');
  }

  private async handleBookPickup(
    session: UssdSessionRecord,
    latestInput: string | null,
  ) {
    const pickupAddress = latestInput?.trim();
    if (!pickupAddress) {
      return this.con('Enter pickup address');
    }

    await this.saveSession({
      ...session,
      step: 'BOOK_DELIVERY',
      data: {
        ...session.data,
        pickupAddress,
      },
    });
    return this.con('Enter delivery address');
  }

  private async handleBookDelivery(
    session: UssdSessionRecord,
    latestInput: string | null,
  ) {
    const deliveryAddress = latestInput?.trim();
    if (!deliveryAddress) {
      return this.con('Enter delivery address');
    }

    await this.saveSession({
      ...session,
      step: 'BOOK_CARGO',
      data: {
        ...session.data,
        deliveryAddress,
      },
    });
    return this.con('Enter cargo description');
  }

  private async handleBookCargo(
    session: UssdSessionRecord,
    latestInput: string | null,
  ) {
    const cargoDescription = latestInput?.trim();
    if (!cargoDescription) {
      return this.con('Enter cargo description');
    }

    await this.saveSession({
      ...session,
      step: 'BOOK_CONFIRM',
      data: {
        ...session.data,
        cargoDescription,
      },
    });

    return this.con(
      `Confirm booking\n1. Yes\n2. Cancel\n${session.data.serviceLabel ?? 'Service'}\nFrom: ${this.truncate(
        session.data.pickupAddress ?? '',
      )}\nTo: ${this.truncate(session.data.deliveryAddress ?? '')}`,
    );
  }

  private async handleBookConfirm(
    session: UssdSessionRecord,
    latestInput: string | null,
  ) {
    if (latestInput === '2') {
      await this.clearSession(session.sessionId);
      return this.end('Booking cancelled.');
    }
    if (latestInput !== '1') {
      return this.con('Confirm booking\n1. Yes\n2. Cancel');
    }

    try {
      const customer = await this.ensureCustomerForPhone(session.phoneNumber);
      const agency = await this.resolveAgency(customer.agencyId);
      const result = await this.bookingsService.create(
        customer.id,
        {
          serviceType: session.data.serviceType as ServiceType,
          vehicleType: session.data.vehicleType as VehicleType,
          idempotencyKey: randomUUID(),
          agencyId: agency.id,
          cargoDescription: session.data.cargoDescription,
          cargoType: 'GENERAL',
          specialInstructions:
            'USSD fallback booking captured without precise map coordinates. Operations review required.',
          stops: [
            {
              sequence: 1,
              address: session.data.pickupAddress,
              latitude: agency.latitude ?? 0,
              longitude: agency.longitude ?? 0,
              contactName: customer.fullName ?? 'USSD Customer',
              contactPhone: customer.phone,
              stopType: 'PICKUP',
            },
            {
              sequence: 2,
              address: session.data.deliveryAddress,
              latitude: agency.latitude ?? 0,
              longitude: agency.longitude ?? 0,
              contactName: customer.fullName ?? 'USSD Customer',
              contactPhone: customer.phone,
              stopType: 'DROPOFF',
            },
          ],
        },
        customer.role,
      );

      await this.smsService.send(
        session.phoneNumber,
        `ZITO booking ${result.booking.reference} created. Total KES ${result.booking.totalPrice}. Our team will confirm route details if map coordinates need review.`,
      );
      await this.clearSession(session.sessionId);

      return this.end(
        `Booking ${result.booking.reference} created. Total KES ${result.booking.totalPrice}. SMS sent.`,
      );
    } catch (error) {
      await this.clearSession(session.sessionId);
      return this.end(this.errorMessage(error, 'Booking could not be created.'));
    }
  }

  private async handleTrackReference(
    session: UssdSessionRecord,
    latestInput: string | null,
  ) {
    const reference = latestInput?.trim().toUpperCase();
    if (!reference) {
      return this.con('Enter booking reference');
    }

    try {
      const booking = await this.findBookingByReference(reference, session.phoneNumber);
      await this.clearSession(session.sessionId);
      return this.end(
        `${booking.reference}: ${booking.status}${
          booking.driverPhone ? ` Driver ${booking.driverPhone}` : ''
        }`,
      );
    } catch (error) {
      await this.clearSession(session.sessionId);
      return this.end(this.errorMessage(error, 'Booking not found.'));
    }
  }

  private async handlePayReference(
    session: UssdSessionRecord,
    latestInput: string | null,
  ) {
    const reference = latestInput?.trim().toUpperCase();
    if (!reference) {
      return this.con('Enter booking reference');
    }

    try {
      const booking = await this.findBookingByReference(reference, session.phoneNumber);
      await this.saveSession({
        ...session,
        step: 'PAY_CONFIRM',
        data: {
          bookingId: booking.id,
          bookingReference: booking.reference,
          amount: String(booking.totalPrice),
        },
      });
      return this.con(
        `Pay KES ${booking.totalPrice} for ${booking.reference}\n1. Confirm\n2. Cancel`,
      );
    } catch (error) {
      await this.clearSession(session.sessionId);
      return this.end(this.errorMessage(error, 'Booking not found.'));
    }
  }

  private async handlePayConfirm(
    session: UssdSessionRecord,
    latestInput: string | null,
  ) {
    if (latestInput === '2') {
      await this.clearSession(session.sessionId);
      return this.end('Payment cancelled.');
    }
    if (latestInput !== '1') {
      return this.con(
        `Pay KES ${session.data.amount ?? '0'} for ${
          session.data.bookingReference ?? 'booking'
        }\n1. Confirm\n2. Cancel`,
      );
    }

    try {
      const payment = await this.paymentsService.initiatePayment(
        session.data.bookingId,
        Number(session.data.amount ?? 0),
        PaymentMethod.MPESA,
        `ussd-payment:${session.sessionId}:${session.data.bookingId}`,
      );

      await this.smsService.send(
        session.phoneNumber,
        `ZITO payment initiated for ${session.data.bookingReference}. Follow the M-Pesa prompt to complete payment.`,
      );
      await this.clearSession(session.sessionId);

      const reference =
        typeof payment === 'object' && payment && 'reference' in payment
          ? String(payment.reference)
          : session.data.bookingReference;

      return this.end(`Payment initiated for ${reference}. SMS sent.`);
    } catch (error) {
      await this.clearSession(session.sessionId);
      return this.end(this.errorMessage(error, 'Payment could not be started.'));
    }
  }

  private async ensureCustomerForPhone(phoneNumber: string) {
    const existing = await this.prisma.user.findUnique({
      where: { phone: phoneNumber },
      select: {
        id: true,
        role: true,
        status: true,
        fullName: true,
        phone: true,
        agencyId: true,
      },
    });

    if (existing) {
      if (
        existing.status === AccountStatus.SUSPENDED ||
        existing.status === AccountStatus.REJECTED
      ) {
        throw new BadRequestException(
          'Account is not eligible for USSD booking. Contact support.',
        );
      }
      if (
        existing.role !== UserRole.CUSTOMER &&
        existing.role !== UserRole.CORPORATE
      ) {
        throw new BadRequestException(
          'USSD booking is only available for customer-facing accounts.',
        );
      }
      return existing;
    }

    const created = await this.prisma.user.create({
      data: {
        phone: phoneNumber,
        fullName: `USSD ${phoneNumber.slice(-4)}`,
        role: UserRole.CUSTOMER,
        status: AccountStatus.ACTIVE,
      },
      select: {
        id: true,
        role: true,
        status: true,
        fullName: true,
        phone: true,
        agencyId: true,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        userId: created.id,
        action: 'USSD_CUSTOMER_AUTO_CREATED',
        entityType: 'USER',
        entityId: created.id,
        details: {
          phone: phoneNumber,
          channel: 'USSD',
        } as Prisma.InputJsonValue,
      },
    });

    return created;
  }

  private async resolveAgency(preferredAgencyId: string | null) {
    const preferred = preferredAgencyId
      ? await this.prisma.agency.findFirst({
          where: {
            id: preferredAgencyId,
            status: 'ACTIVE',
          },
          select: {
            id: true,
            name: true,
            latitude: true,
            longitude: true,
          },
        })
      : null;
    if (preferred) {
      return preferred;
    }

    const fallback = await this.prisma.agency.findFirst({
      where: { status: 'ACTIVE' },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        name: true,
        latitude: true,
        longitude: true,
      },
    });
    if (!fallback) {
      throw new NotFoundException('No active agency is available for USSD booking.');
    }
    return fallback;
  }

  private async findBookingByReference(reference: string, phoneNumber: string) {
    const user = await this.prisma.user.findUnique({
      where: { phone: phoneNumber },
      select: { id: true },
    });
    if (!user) {
      throw new NotFoundException('Booking not found');
    }

    const booking = await this.prisma.booking.findFirst({
      where: {
        reference,
        customerId: user.id,
      },
      select: {
        id: true,
        reference: true,
        status: true,
        totalPrice: true,
        driver: {
          select: {
            user: {
              select: {
                phone: true,
              },
            },
          },
        },
      },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    return {
      id: booking.id,
      reference: booking.reference,
      status: booking.status,
      totalPrice: booking.totalPrice,
      driverPhone: booking.driver?.user.phone ?? null,
    };
  }

  private async getSession(input: {
    sessionId: string;
    phoneNumber: string;
    serviceCode?: string;
  }) {
    const existing = await this.prisma.idempotencyRecord.findUnique({
      where: { key: this.sessionKey(input.sessionId) },
      select: { response: true },
    });
    const stored = this.asSessionRecord(existing?.response);
    if (stored) {
      return stored;
    }

    const session: UssdSessionRecord = {
      sessionId: input.sessionId,
      phoneNumber: input.phoneNumber,
      serviceCode: input.serviceCode ?? null,
      step: 'ROOT',
      data: {},
      updatedAt: new Date().toISOString(),
    };
    await this.saveSession(session);
    return session;
  }

  private async saveSession(session: UssdSessionRecord) {
    await this.prisma.idempotencyRecord.upsert({
      where: { key: this.sessionKey(session.sessionId) },
      create: {
        key: this.sessionKey(session.sessionId),
        status: session.step,
        requestHash: session.phoneNumber,
        response: {
          ...session,
          updatedAt: new Date().toISOString(),
        } as Prisma.InputJsonValue,
        expiresAt: new Date(Date.now() + this.sessionTtlMs),
      },
      update: {
        status: session.step,
        requestHash: session.phoneNumber,
        response: {
          ...session,
          updatedAt: new Date().toISOString(),
        } as Prisma.InputJsonValue,
        expiresAt: new Date(Date.now() + this.sessionTtlMs),
      },
    });
  }

  private async clearSession(sessionId: string) {
    await this.prisma.idempotencyRecord.deleteMany({
      where: { key: this.sessionKey(sessionId) },
    });
  }

  private sessionKey(sessionId: string) {
    return `${this.sessionPrefix}${sessionId}`;
  }

  private asSessionRecord(value: Prisma.JsonValue | null | undefined) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }

    const record = value as Record<string, Prisma.JsonValue>;
    if (
      typeof record.sessionId !== 'string' ||
      typeof record.phoneNumber !== 'string' ||
      typeof record.step !== 'string'
    ) {
      return null;
    }

    return {
      sessionId: record.sessionId,
      phoneNumber: record.phoneNumber,
      serviceCode:
        typeof record.serviceCode === 'string' ? record.serviceCode : null,
      step: record.step as UssdSessionStep,
      data: this.asStringMap(record.data),
      updatedAt:
        typeof record.updatedAt === 'string'
          ? record.updatedAt
          : new Date().toISOString(),
    } satisfies UssdSessionRecord;
  }

  private asStringMap(value: Prisma.JsonValue | null | undefined) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }

    return Object.fromEntries(
      Object.entries(value as Record<string, Prisma.JsonValue>).flatMap(
        ([key, current]) =>
          typeof current === 'string' ? [[key, current]] : [],
      ),
    );
  }

  private latestSegment(text?: string) {
    if (!text || text.trim() === '') {
      return null;
    }
    const segments = text
      .split('*')
      .map((segment) => segment.trim())
      .filter(Boolean);
    return segments.length > 0 ? segments[segments.length - 1] : null;
  }

  private mapServiceSelection(choice: string | null) {
    switch (choice) {
      case '1':
        return {
          label: 'Courier',
          serviceType: ServiceType.COURIER,
          vehicleType: VehicleType.MOTORBIKE,
        };
      case '2':
        return {
          label: 'Partial load',
          serviceType: ServiceType.PTL,
          vehicleType: VehicleType.VAN,
        };
      case '3':
        return {
          label: 'Full truck',
          serviceType: ServiceType.FTL,
          vehicleType: VehicleType.TRUCK_7T,
        };
      default:
        return null;
    }
  }

  private con(message: string) {
    return `CON ${message}`;
  }

  private end(message: string) {
    return `END ${message}`;
  }

  private truncate(value: string, length = 18) {
    return value.length <= length ? value : `${value.slice(0, length - 3)}...`;
  }

  private errorMessage(error: unknown, fallback: string) {
    if (error instanceof BadRequestException || error instanceof NotFoundException) {
      const response = error.getResponse();
      if (typeof response === 'string') {
        return response;
      }
      if (
        response &&
        typeof response === 'object' &&
        'message' in response &&
        typeof response.message === 'string'
      ) {
        return response.message;
      }
      if (
        response &&
        typeof response === 'object' &&
        'message' in response &&
        Array.isArray(response.message) &&
        typeof response.message[0] === 'string'
      ) {
        return response.message[0];
      }
    }
    if (error instanceof Error && error.message) {
      return error.message;
    }
    return fallback;
  }
}
