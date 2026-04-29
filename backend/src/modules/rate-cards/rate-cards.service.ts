import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ServiceType, VehicleType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CalculateRateCardDto,
  CreateRateCardDto,
  UpdateRateCardDto,
} from './dto/rate-card.dto';

type ListFilters = {
  vehicleType?: VehicleType;
  serviceType?: ServiceType;
  includeInactive?: boolean;
};

@Injectable()
export class RateCardsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(filters: ListFilters) {
    const rateCards = await this.prisma.rateCard.findMany({
      where: {
        ...(filters.vehicleType && { vehicleType: filters.vehicleType }),
        ...(filters.serviceType && { serviceType: filters.serviceType }),
        ...(filters.includeInactive ? {} : { isActive: true }),
      },
      orderBy: [
        { vehicleType: 'asc' },
        { serviceType: 'asc' },
        { version: 'desc' },
      ],
    });

    return {
      rateCards,
      total: rateCards.length,
    };
  }

  async getById(id: string) {
    const rateCard = await this.prisma.rateCard.findUnique({ where: { id } });
    if (!rateCard) {
      throw new NotFoundException(`Rate card ${id} not found`);
    }
    return rateCard;
  }

  async create(dto: CreateRateCardDto, userId: string) {
    const latestVersion = await this.prisma.rateCard.findFirst({
      where: {
        vehicleType: dto.vehicleType,
        serviceType: dto.serviceType,
      },
      orderBy: { version: 'desc' },
    });

    const created = await this.prisma.$transaction(async (tx) => {
      if (dto.isActive ?? true) {
        await tx.rateCard.updateMany({
          where: {
            vehicleType: dto.vehicleType,
            serviceType: dto.serviceType,
            isActive: true,
          },
          data: { isActive: false },
        });
      }

      return tx.rateCard.create({
        data: {
          vehicleType: dto.vehicleType,
          serviceType: dto.serviceType,
          baseFare: dto.baseFare,
          ratePerKm: dto.ratePerKm,
          perStopRate: dto.perStopRate ?? 0,
          minDistance: dto.minDistance ?? 0,
          surgeMultiplier: dto.surgeMultiplier ?? 1,
          isActive: dto.isActive ?? true,
          version: (latestVersion?.version ?? 0) + 1,
        },
      });
    });

    await this.writeAudit(userId, 'RATE_CARD_CREATED', created.id, {
      newValues: created,
    });

    return created;
  }

  async update(id: string, dto: UpdateRateCardDto, userId: string) {
    const current = await this.getById(id);

    if (
      dto.baseFare == null &&
      dto.ratePerKm == null &&
      dto.perStopRate == null &&
      dto.minDistance == null &&
      dto.surgeMultiplier == null &&
      dto.isActive == null
    ) {
      throw new BadRequestException('At least one field must be provided');
    }

    const nextValues = {
      vehicleType: current.vehicleType,
      serviceType: current.serviceType,
      baseFare: dto.baseFare ?? current.baseFare,
      ratePerKm: dto.ratePerKm ?? current.ratePerKm,
      perStopRate: dto.perStopRate ?? current.perStopRate,
      minDistance: dto.minDistance ?? current.minDistance,
      surgeMultiplier: dto.surgeMultiplier ?? current.surgeMultiplier,
      isActive: dto.isActive ?? current.isActive,
      version: current.version + 1,
    };

    const created = await this.prisma.$transaction(async (tx) => {
      await tx.rateCard.updateMany({
        where: {
          vehicleType: current.vehicleType,
          serviceType: current.serviceType,
          isActive: true,
        },
        data: { isActive: false },
      });

      return tx.rateCard.create({ data: nextValues });
    });

    await this.writeAudit(userId, 'RATE_CARD_VERSIONED', created.id, {
      previousRateCardId: current.id,
      oldValues: current,
      newValues: created,
    });

    return created;
  }

  async calculate(dto: CalculateRateCardDto) {
    const rateCard = await this.prisma.rateCard.findFirst({
      where: {
        vehicleType: dto.vehicleType,
        serviceType: dto.serviceType,
        isActive: true,
      },
      orderBy: { version: 'desc' },
    });

    if (!rateCard) {
      throw new NotFoundException(
        `No active rate card for ${dto.vehicleType} + ${dto.serviceType}`,
      );
    }

    const effectiveDistance = Math.max(dto.distanceKm, rateCard.minDistance);
    const baseFare = rateCard.baseFare;
    const distanceFare = Number((effectiveDistance * rateCard.ratePerKm).toFixed(2));
    const stopFare = Number((dto.stopCount * rateCard.perStopRate).toFixed(2));
    const surgeMultiplier = rateCard.surgeMultiplier;
    const subtotal = Number((baseFare + distanceFare + stopFare).toFixed(2));
    const totalPrice = Number((subtotal * surgeMultiplier).toFixed(2));

    return {
      rateCard,
      effectiveDistance,
      baseFare,
      distanceFare,
      stopFare,
      surgeMultiplier,
      totalPrice,
    };
  }

  private async writeAudit(
    userId: string,
    action: string,
    entityId: string,
    details: Record<string, unknown>,
  ) {
    try {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        return;
      }

      await this.prisma.auditLog.create({
        data: {
          userId,
          action,
          entityType: 'RATE_CARD',
          entityId,
          details: details as Prisma.InputJsonValue,
        },
      });
    } catch {
      // Rate-card changes should not fail because audit logging was unavailable.
    }
  }
}
