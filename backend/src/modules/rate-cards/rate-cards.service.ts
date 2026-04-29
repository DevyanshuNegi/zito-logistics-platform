import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ServiceType, VehicleType } from '@prisma/client';
import {
  COUNTRY_CONFIGS,
  DEFAULT_CURRENCY,
  SUPPORTED_CURRENCIES,
  SUPPORTED_COUNTRY_CODES,
  SUPPORTED_CURRENCY_CODES,
  type SupportedCountryCode,
  type SupportedCurrencyCode,
} from '../../config/app.config';
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

  listSupportedCurrencies() {
    return {
      baseCurrency: DEFAULT_CURRENCY,
      currencies: SUPPORTED_CURRENCY_CODES.map((code) => SUPPORTED_CURRENCIES[code]),
    };
  }

  countryConfig(countryCode?: string) {
    const normalized = this.normalizeCountry(countryCode);
    return {
      country: COUNTRY_CONFIGS[normalized],
      supportedCountries: SUPPORTED_COUNTRY_CODES.map((code) => COUNTRY_CONFIGS[code]),
    };
  }

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
    const country = COUNTRY_CONFIGS[this.normalizeCountry(dto.countryCode)];
    const countryAdjustedBaseFare = this.round(baseFare * country.rateMultiplier);
    const countryAdjustedDistanceFare = this.round(
      distanceFare * country.rateMultiplier,
    );
    const countryAdjustedStopFare = this.round(stopFare * country.rateMultiplier);
    const subtotal = Number(
      (
        countryAdjustedBaseFare +
        countryAdjustedDistanceFare +
        countryAdjustedStopFare
      ).toFixed(2),
    );
    const totalPrice = Number((subtotal * surgeMultiplier).toFixed(2));
    const taxAmount = this.round((totalPrice * country.vatRate) / 100);
    const grandTotal = this.round(totalPrice + taxAmount);
    const currency = this.normalizeCurrency(dto.currency ?? country.currency);
    const convertedQuote = this.convertCurrency(
      {
        baseFare: countryAdjustedBaseFare,
        distanceFare: countryAdjustedDistanceFare,
        stopFare: countryAdjustedStopFare,
        subtotal,
        totalPrice,
        taxAmount,
        grandTotal,
      },
      currency,
    );

    return {
      rateCard,
      effectiveDistance,
      baseCurrency: DEFAULT_CURRENCY,
      country,
      currency,
      fxRateFromKes: SUPPORTED_CURRENCIES[currency].rateFromKes,
      baseFare: convertedQuote.baseFare,
      distanceFare: convertedQuote.distanceFare,
      stopFare: convertedQuote.stopFare,
      surgeMultiplier,
      subtotal: convertedQuote.subtotal,
      totalPrice: convertedQuote.totalPrice,
      taxAmount: convertedQuote.taxAmount,
      grandTotal: convertedQuote.grandTotal,
      baseCurrencyQuote: {
        currency: DEFAULT_CURRENCY,
        baseFare: countryAdjustedBaseFare,
        distanceFare: countryAdjustedDistanceFare,
        stopFare: countryAdjustedStopFare,
        subtotal,
        totalPrice,
        taxAmount,
        grandTotal,
      },
      notes: [
        'Country pricing applies a country-specific rate multiplier before tax so a shared Phase 0 rate-card table can still serve multi-country pricing rules.',
        'If no currency is requested, the quote defaults to the configured currency for the selected operating country.',
      ],
    };
  }

  private normalizeCurrency(code?: string): SupportedCurrencyCode {
    const normalized = (code ?? DEFAULT_CURRENCY).toUpperCase() as SupportedCurrencyCode;
    if (!SUPPORTED_CURRENCY_CODES.includes(normalized)) {
      throw new BadRequestException(`Unsupported currency ${code}`);
    }
    return normalized;
  }

  private normalizeCountry(code?: string): SupportedCountryCode {
    const normalized = (code ?? 'KE').toUpperCase() as SupportedCountryCode;
    if (!SUPPORTED_COUNTRY_CODES.includes(normalized)) {
      throw new BadRequestException(`Unsupported country code ${code}`);
    }
    return normalized;
  }

  private convertCurrency(
    quote: {
      baseFare: number;
      distanceFare: number;
      stopFare: number;
      subtotal: number;
      totalPrice: number;
      taxAmount: number;
      grandTotal: number;
    },
    currency: SupportedCurrencyCode,
  ) {
    const rate = SUPPORTED_CURRENCIES[currency].rateFromKes;
    const convert = (amount: number) => Number((amount * rate).toFixed(2));

    return {
      baseFare: convert(quote.baseFare),
      distanceFare: convert(quote.distanceFare),
      stopFare: convert(quote.stopFare),
      subtotal: convert(quote.subtotal),
      totalPrice: convert(quote.totalPrice),
      taxAmount: convert(quote.taxAmount),
      grandTotal: convert(quote.grandTotal),
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

  private round(value: number) {
    return Number(value.toFixed(2));
  }
}
