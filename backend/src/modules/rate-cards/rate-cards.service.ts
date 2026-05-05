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

const LOCATION_RATE_TYPES = ['ANY', 'TOWN', 'RURAL'] as const;
type LocationRateType = (typeof LOCATION_RATE_TYPES)[number];

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
    const countryCode = this.normalizeCountry(dto.countryCode);
    const county = this.normalizeCounty(dto.county, countryCode);
    const localityType = this.normalizeLocalityType(dto.localityType);

    const latestVersion = await this.prisma.rateCard.findFirst({
      where: {
        vehicleType: dto.vehicleType,
        serviceType: dto.serviceType,
        countryCode,
        county,
        localityType,
      },
      orderBy: { version: 'desc' },
    });

    const created = await this.prisma.$transaction(async (tx) => {
      if (dto.isActive ?? true) {
        await tx.rateCard.updateMany({
          where: {
            vehicleType: dto.vehicleType,
            serviceType: dto.serviceType,
            countryCode,
            county,
            localityType,
            isActive: true,
          },
          data: { isActive: false },
        });
      }

      return tx.rateCard.create({
        data: {
          vehicleType: dto.vehicleType,
          serviceType: dto.serviceType,
          countryCode,
          county,
          localityType,
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
      dto.countryCode == null &&
      dto.county == null &&
      dto.localityType == null &&
      dto.baseFare == null &&
      dto.ratePerKm == null &&
      dto.perStopRate == null &&
      dto.minDistance == null &&
      dto.surgeMultiplier == null &&
      dto.isActive == null
    ) {
      throw new BadRequestException('At least one field must be provided');
    }

    const nextCountryCode = this.normalizeCountry(dto.countryCode ?? current.countryCode);
    const nextCounty = this.normalizeCounty(dto.county ?? current.county, nextCountryCode);
    const nextLocalityType = this.normalizeLocalityType(
      dto.localityType ?? current.localityType,
    );

    const nextValues = {
      vehicleType: current.vehicleType,
      serviceType: current.serviceType,
      countryCode: nextCountryCode,
      county: nextCounty,
      localityType: nextLocalityType,
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
          countryCode: current.countryCode,
          county: current.county,
          localityType: current.localityType,
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
    const countryCode = this.normalizeCountry(dto.countryCode);
    const county = this.normalizeCounty(dto.county, countryCode);
    const localityType = this.normalizeLocalityType(dto.localityType);

    const candidateCards = await this.prisma.rateCard.findMany({
      where: {
        vehicleType: dto.vehicleType,
        serviceType: dto.serviceType,
        countryCode,
        isActive: true,
      },
    });

    const rankedCards = candidateCards
      .map((rateCard) => ({
        rateCard,
        score: this.scoreRateCardScope(rateCard, county, localityType, countryCode),
      }))
      .filter((entry) => entry.score >= 0)
      .sort((left, right) => {
        if (right.score !== left.score) {
          return right.score - left.score;
        }
        return right.rateCard.version - left.rateCard.version;
      });

    const rateCard = rankedCards[0]?.rateCard;

    if (!rateCard) {
      throw new NotFoundException(
        `No active rate card for ${dto.vehicleType} + ${dto.serviceType} in ${countryCode}${county ? ` / ${county}` : ''}${localityType !== 'ANY' ? ` / ${localityType}` : ''}`,
      );
    }

    const effectiveDistance = Math.max(dto.distanceKm, rateCard.minDistance);
    const baseFare = rateCard.baseFare;
    const distanceFare = Number((effectiveDistance * rateCard.ratePerKm).toFixed(2));
    const stopFare = Number((dto.stopCount * rateCard.perStopRate).toFixed(2));
    const surgeMultiplier = rateCard.surgeMultiplier;
    const country = COUNTRY_CONFIGS[countryCode];
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
      pricingScope: {
        countryCode: rateCard.countryCode,
        county: rateCard.county,
        localityType: rateCard.localityType,
      },
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
        countryCode === 'KE'
          ? 'Kenya pricing can now resolve to a county-level card and can differentiate town vs rural coverage before tax and surge are applied.'
          : 'Location-scope fallback still respects the active country pricing card before tax and surge are applied.',
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

  private normalizeCounty(county: string | null | undefined, countryCode: SupportedCountryCode) {
    if (countryCode !== 'KE') {
      return null;
    }

    const trimmed = county?.trim();
    if (!trimmed) {
      return null;
    }

    return trimmed
      .split(/\s+/)
      .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase())
      .join(' ');
  }

  private normalizeLocalityType(value?: string | null): LocationRateType {
    const normalized = (value ?? 'ANY').toUpperCase() as LocationRateType;
    if (!LOCATION_RATE_TYPES.includes(normalized)) {
      throw new BadRequestException(`Unsupported locality type ${value}`);
    }
    return normalized;
  }

  private scoreRateCardScope(
    rateCard: {
      county: string | null;
      localityType: string;
    },
    county: string | null,
    localityType: LocationRateType,
    countryCode: SupportedCountryCode,
  ) {
    let score = 100;

    if (countryCode !== 'KE') {
      if (rateCard.county) {
        return -1;
      }
      if (rateCard.localityType !== 'ANY') {
        return -1;
      }
      return score;
    }

    if (county) {
      if (rateCard.county && rateCard.county !== county) {
        return -1;
      }
      if (rateCard.county === county) {
        score += 20;
      }
    } else if (rateCard.county) {
      return -1;
    }

    if (localityType !== 'ANY') {
      if (rateCard.localityType === localityType) {
        score += 10;
      } else if (rateCard.localityType !== 'ANY') {
        return -1;
      }
    } else if (rateCard.localityType !== 'ANY') {
      return -1;
    }

    return score;
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
