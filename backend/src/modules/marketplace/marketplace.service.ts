import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AccountStatus,
  BookingStatus,
  Prisma,
  ServiceType,
  UserRole,
  VehicleStatus,
  VehicleType,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateMarketplaceAgentDto,
  CreateMarketplaceCourierCompanyDto,
  CreateMarketplaceTransporterDto,
  CreateMarketplaceWarehouseDto,
  MarketplaceBidDto,
  PublishMarketplaceOpportunityDto,
  RespondMarketplaceBidDto,
  UpdateMarketplacePartnerStatusDto,
} from './dto/marketplace.dto';

type MarketplacePartnerType =
  | 'TRANSPORTER'
  | 'COURIER_COMPANY'
  | 'AGENT'
  | 'WAREHOUSE';
type MarketplacePartnerStatus =
  | 'PENDING_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'SUSPENDED';
type MarketplacePricingModel = 'FIXED_PRICE' | 'OPEN_BID' | 'NEGOTIATION';
type MarketplaceOpportunityStatus = 'OPEN' | 'AWARDED' | 'CLOSED' | 'CANCELLED';
type MarketplaceBidStatus = 'PENDING' | 'COUNTERED' | 'ACCEPTED' | 'REJECTED';

type OpportunityStopPoint = {
  latitude: number;
  longitude: number;
  areaHint: string | null;
  stopType: string | null;
};

type OpportunityRouteSummary = {
  pickupArea: string | null;
  deliveryArea: string | null;
  viaAreas: string[];
  summary: string;
};

type OpportunityStopSummary = {
  totalStops: number;
  pickupStops: number;
  deliveryStops: number;
  intermediateStops: number;
};

type OpportunityFleetRequirements = {
  vehicleType: VehicleType | null;
  minimumCapacityKg: number | null;
  minimumCapacityM3: number | null;
  cargoType: string | null;
  cargoWeightKg: number | null;
  estimatedDistanceKm: number | null;
  specialHandling: string[];
};

type MarketplacePartnerRecord = {
  userId: string;
  partnerType: MarketplacePartnerType;
  companyName: string;
  serviceAreas: string[];
  vehicleIds: string[];
  warehouseIds: string[];
  baseLatitude: number | null;
  baseLongitude: number | null;
  serviceRadiusKm: number | null;
  commissionRatePct: number;
  serviceFeeFlat: number;
  premiumListing: boolean;
  verificationStatus: MarketplacePartnerStatus;
  verificationNote: string | null;
  submittedBy: string;
  createdAt: string;
  updatedAt: string;
  approvedBy: string | null;
  approvedAt: string | null;
  rejectedBy: string | null;
  rejectedAt: string | null;
  suspendedBy: string | null;
  suspendedAt: string | null;
};

type MarketplaceBidRecord = {
  id: string;
  partnerId: string;
  amount: number;
  note: string | null;
  submittedAt: string;
  status: MarketplaceBidStatus;
  counterAmount: number | null;
  respondedAt: string | null;
  respondedBy: string | null;
};

type MarketplaceOpportunityRecord = {
  bookingId: string;
  bookingReference: string;
  serviceType: ServiceType;
  partnerType: MarketplacePartnerType;
  pricingModel: MarketplacePricingModel;
  status: MarketplaceOpportunityStatus;
  publishedBy: string;
  publishedAt: string;
  updatedAt: string;
  expiresAt: string | null;
  currency: string;
  bookingPrice: number;
  fixedPrice: number | null;
  minimumBid: number | null;
  serviceAreaHints: string[];
  stopPoints: OpportunityStopPoint[];
  routeSummary: OpportunityRouteSummary;
  stopSummary: OpportunityStopSummary;
  fleetRequirements: OpportunityFleetRequirements;
  bids: MarketplaceBidRecord[];
  awardedPartnerId: string | null;
  selectedBidId: string | null;
  awardedAt: string | null;
  awardedBy: string | null;
  commissionAmount: number | null;
  commissionRatePct: number | null;
  serviceFeeFlat: number | null;
  premiumListingFee: number | null;
  partnerNetAmount: number | null;
};

type PartnerPerformance = {
  partnerId: string;
  partnerType: MarketplacePartnerType;
  verificationStatus: MarketplacePartnerStatus;
  companyName: string;
  awardedTransactions: number;
  completedTransactions: number;
  cancelledTransactions: number;
  openTransactions: number;
  delayedTransactions: number;
  fraudIncidents: number;
  bidCount: number;
  acceptanceRate: number;
  completionRate: number;
  onTimeRate: number;
  performanceScore: number;
  statusRecommendation: 'MAINTAIN' | 'REVIEW' | 'SUSPEND';
};

type PartnerHydrated = MarketplacePartnerRecord & {
  user: {
    id: string;
    fullName: string | null;
    email: string | null;
    phone: string | null;
    role: UserRole;
    status: AccountStatus;
    agencyId: string | null;
  } | null;
  linkedVehicles: Array<{
    id: string;
    plateNumber: string;
    type: VehicleType;
    status: VehicleStatus;
    capacityKg: number;
    capacityM3: number | null;
  }>;
  linkedWarehouses: Array<{
    id: string;
    name: string;
    code: string;
    status: string;
    address: string | null;
  }>;
  performance: PartnerPerformance | null;
};

type OpportunityHydrated = MarketplaceOpportunityRecord & {
  booking: {
    id: string;
    reference: string;
    status: BookingStatus;
    serviceType: ServiceType;
    totalPrice: number;
    customerId: string;
    customerLabel: string;
    stops: Array<{
      sequence: number;
      address: string;
      latitude: number;
      longitude: number;
      stopType: string;
    }>;
  } | null;
  awardedPartner: PartnerHydrated | null;
  bidsDetailed: Array<MarketplaceBidRecord & { partner: PartnerHydrated | null }>;
  matchedPartnerIds: string[];
};

type PartnerOpportunityView = {
  bookingId: string;
  bookingReference: string;
  serviceType: ServiceType;
  partnerType: MarketplacePartnerType;
  pricingModel: MarketplacePricingModel;
  status: MarketplaceOpportunityStatus;
  publishedAt: string;
  expiresAt: string | null;
  currency: string;
  bookingPrice: number;
  fixedPrice: number | null;
  minimumBid: number | null;
  serviceAreaHints: string[];
  routeSummary: OpportunityRouteSummary;
  stopSummary: OpportunityStopSummary;
  fleetRequirements: OpportunityFleetRequirements;
  myBid: Pick<
    MarketplaceBidRecord,
    'id' | 'amount' | 'note' | 'submittedAt' | 'status' | 'counterAmount' | 'respondedAt'
  > | null;
  visibility: 'REQUIREMENTS_ONLY';
};

const PARTNER_PREFIX = 'marketplace:partner:';
const OPPORTUNITY_PREFIX = 'marketplace:booking:';
const DEFAULT_COMMISSION_RATE_PCT = Number(
  process.env.MARKETPLACE_DEFAULT_COMMISSION_RATE_PCT ?? 12,
);
const DEFAULT_SERVICE_FEE_FLAT = Number(
  process.env.MARKETPLACE_DEFAULT_SERVICE_FEE_FLAT ?? 0,
);
const DEFAULT_PREMIUM_LISTING_FEE = Number(
  process.env.MARKETPLACE_PREMIUM_LISTING_FEE ?? 25,
);
const LOW_PERFORMANCE_THRESHOLD = Number(
  process.env.MARKETPLACE_LOW_PERFORMANCE_THRESHOLD ?? 60,
);

@Injectable()
export class MarketplaceService {
  constructor(private readonly prisma: PrismaService) {}

  async dashboard() {
    const [partners, opportunities, partnerRecords] = await Promise.all([
      this.listPartners(),
      this.listOpportunities(),
      this.readPartnerRecords(),
    ]);
    const performance = await this.buildPerformanceScorecards(partnerRecords);

    const awarded = opportunities.opportunities.filter(
      (opportunity) => opportunity.status === 'AWARDED',
    );

    return {
      generatedAt: new Date().toISOString(),
      summary: {
        totalPartners: partners.total,
        approvedPartners: partners.partners.filter(
          (partner) => partner.verificationStatus === 'APPROVED',
        ).length,
        pendingPartners: partners.partners.filter(
          (partner) => partner.verificationStatus === 'PENDING_REVIEW',
        ).length,
        suspendedPartners: partners.partners.filter(
          (partner) => partner.verificationStatus === 'SUSPENDED',
        ).length,
        openOpportunities: opportunities.opportunities.filter(
          (opportunity) => opportunity.status === 'OPEN',
        ).length,
        awardedTransactions: awarded.length,
        totalCommissionRevenue: this.round(
          awarded.reduce(
            (sum, opportunity) => sum + (opportunity.commissionAmount ?? 0),
            0,
          ),
        ),
        totalServiceFees: this.round(
          awarded.reduce(
            (sum, opportunity) => sum + (opportunity.serviceFeeFlat ?? 0),
            0,
          ),
        ),
        totalPremiumListingRevenue: this.round(
          awarded.reduce(
            (sum, opportunity) => sum + (opportunity.premiumListingFee ?? 0),
            0,
          ),
        ),
      },
      partners: partners.partners,
      opportunities: opportunities.opportunities,
      performance,
      notes: [
        'Marketplace partner state, bidding, and commission tracking are stored through schema-backed IdempotencyRecord keys because the Phase 0 schema intentionally shipped without dedicated marketplace tables.',
        'Service-availability matching uses partner-declared service areas plus optional base-location radius, which keeps the flow PRD-compliant without requiring new geospatial models.',
      ],
    };
  }

  async listPartners(filters: { type?: string; status?: string } = {}) {
    const records = await this.readPartnerRecords();
    const filtered = records.filter((record) => {
      if (filters.type && record.partnerType !== filters.type.toUpperCase()) {
        return false;
      }
      if (
        filters.status &&
        record.verificationStatus !== filters.status.toUpperCase()
      ) {
        return false;
      }
      return true;
    });

    const scorecards = await this.buildPerformanceScorecards(records);
    const scoreMap = new Map(scorecards.map((score) => [score.partnerId, score]));
    const partners = await this.hydratePartners(filtered, scoreMap);

    return {
      partners,
      total: partners.length,
    };
  }

  async listOpportunities(filters: { status?: string } = {}) {
    const records = await this.readOpportunityRecords();
    const filtered = filters.status
      ? records.filter(
          (record) => record.status === filters.status?.trim().toUpperCase(),
        )
      : records;
    const opportunities = await this.hydrateOpportunities(filtered);

    return {
      opportunities,
      total: opportunities.length,
    };
  }

  async getPartnerProfile(userId: string) {
    const record = await this.getPartnerRecordOrThrow(userId);
    const scorecards = await this.buildPerformanceScorecards([record]);
    const partners = await this.hydratePartners(
      [record],
      new Map(scorecards.map((score) => [score.partnerId, score])),
    );
    return partners[0];
  }

  async onboardTransporter(
    dto: CreateMarketplaceTransporterDto,
    actorId: string,
  ) {
    const user = await this.ensureUserRole(dto.userId, UserRole.TRANSPORTER);
    await this.assertVehiclesExist(dto.vehicleIds ?? []);
    const existing = await this.readPartnerRecord(dto.userId);

    const record: MarketplacePartnerRecord = {
      ...(existing ?? {}),
      userId: dto.userId,
      partnerType: 'TRANSPORTER',
      companyName: dto.companyName.trim(),
      serviceAreas: (dto.serviceAreas ?? []).map((value) => value.trim()).filter(Boolean),
      vehicleIds: [...new Set(dto.vehicleIds ?? [])],
      warehouseIds: [],
      baseLatitude: dto.baseLatitude ?? null,
      baseLongitude: dto.baseLongitude ?? null,
      serviceRadiusKm: dto.serviceRadiusKm ?? null,
      commissionRatePct:
        dto.commissionRatePct ?? DEFAULT_COMMISSION_RATE_PCT,
      serviceFeeFlat: dto.serviceFeeFlat ?? DEFAULT_SERVICE_FEE_FLAT,
      premiumListing: dto.premiumListing ?? false,
      verificationStatus: 'PENDING_REVIEW',
      verificationNote: 'Awaiting marketplace approval',
      submittedBy: actorId,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      approvedBy: null,
      approvedAt: null,
      rejectedBy: null,
      rejectedAt: null,
      suspendedBy: null,
      suspendedAt: null,
    };

    await this.persistPartnerRecord(record);
    await this.raisePartnerAlert(
      dto.userId,
      `${record.companyName} submitted transporter onboarding for review.`,
      'MEDIUM',
      {
        partnerType: record.partnerType,
        actorId,
        serviceAreas: record.serviceAreas,
        vehicleIds: record.vehicleIds,
        role: user.role,
      },
    );
    await this.writeAudit(actorId, 'MARKETPLACE_PARTNER_ONBOARDED', dto.userId, {
      partnerType: record.partnerType,
      companyName: record.companyName,
      vehicleIds: record.vehicleIds,
      serviceAreas: record.serviceAreas,
    });

    return this.getPartnerProfile(dto.userId);
  }

  async onboardCourierCompany(
    dto: CreateMarketplaceCourierCompanyDto,
    actorId: string,
  ) {
    const user = await this.ensureUserRole(dto.userId, UserRole.COURIER_COMPANY);
    await this.assertVehiclesExist(dto.vehicleIds ?? []);
    const existing = await this.readPartnerRecord(dto.userId);

    const record: MarketplacePartnerRecord = {
      ...(existing ?? {}),
      userId: dto.userId,
      partnerType: 'COURIER_COMPANY',
      companyName: dto.companyName.trim(),
      serviceAreas: (dto.serviceAreas ?? []).map((value) => value.trim()).filter(Boolean),
      vehicleIds: [...new Set(dto.vehicleIds ?? [])],
      warehouseIds: [],
      baseLatitude: dto.baseLatitude ?? null,
      baseLongitude: dto.baseLongitude ?? null,
      serviceRadiusKm: dto.serviceRadiusKm ?? null,
      commissionRatePct:
        dto.commissionRatePct ?? DEFAULT_COMMISSION_RATE_PCT,
      serviceFeeFlat: dto.serviceFeeFlat ?? DEFAULT_SERVICE_FEE_FLAT,
      premiumListing: dto.premiumListing ?? false,
      verificationStatus: 'PENDING_REVIEW',
      verificationNote: 'Awaiting marketplace approval',
      submittedBy: actorId,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      approvedBy: null,
      approvedAt: null,
      rejectedBy: null,
      rejectedAt: null,
      suspendedBy: null,
      suspendedAt: null,
    };

    await this.persistPartnerRecord(record);
    await this.raisePartnerAlert(
      dto.userId,
      `${record.companyName} submitted courier company onboarding for review.`,
      'MEDIUM',
      {
        partnerType: record.partnerType,
        actorId,
        serviceAreas: record.serviceAreas,
        vehicleIds: record.vehicleIds,
        role: user.role,
      },
    );
    await this.writeAudit(actorId, 'MARKETPLACE_PARTNER_ONBOARDED', dto.userId, {
      partnerType: record.partnerType,
      companyName: record.companyName,
      vehicleIds: record.vehicleIds,
      serviceAreas: record.serviceAreas,
    });

    return this.getPartnerProfile(dto.userId);
  }

  async onboardAgent(dto: CreateMarketplaceAgentDto, actorId: string) {
    const user = await this.ensureUserRole(dto.userId, UserRole.AGENT);
    await this.assertVehiclesExist(dto.vehicleIds ?? []);
    const existing = await this.readPartnerRecord(dto.userId);

    const record: MarketplacePartnerRecord = {
      ...(existing ?? {}),
      userId: dto.userId,
      partnerType: 'AGENT',
      companyName: dto.companyName.trim(),
      serviceAreas: (dto.serviceAreas ?? []).map((value) => value.trim()).filter(Boolean),
      vehicleIds: [...new Set(dto.vehicleIds ?? [])],
      warehouseIds: [],
      baseLatitude: dto.baseLatitude ?? null,
      baseLongitude: dto.baseLongitude ?? null,
      serviceRadiusKm: dto.serviceRadiusKm ?? null,
      commissionRatePct:
        dto.commissionRatePct ?? DEFAULT_COMMISSION_RATE_PCT,
      serviceFeeFlat: dto.serviceFeeFlat ?? DEFAULT_SERVICE_FEE_FLAT,
      premiumListing: dto.premiumListing ?? false,
      verificationStatus: 'PENDING_REVIEW',
      verificationNote: 'Awaiting marketplace approval',
      submittedBy: actorId,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      approvedBy: null,
      approvedAt: null,
      rejectedBy: null,
      rejectedAt: null,
      suspendedBy: null,
      suspendedAt: null,
    };

    await this.persistPartnerRecord(record);
    await this.raisePartnerAlert(
      dto.userId,
      `${record.companyName} submitted agent onboarding for review.`,
      'MEDIUM',
      {
        partnerType: record.partnerType,
        actorId,
        serviceAreas: record.serviceAreas,
        vehicleIds: record.vehicleIds,
        role: user.role,
      },
    );
    await this.writeAudit(actorId, 'MARKETPLACE_PARTNER_ONBOARDED', dto.userId, {
      partnerType: record.partnerType,
      companyName: record.companyName,
      vehicleIds: record.vehicleIds,
      serviceAreas: record.serviceAreas,
    });

    return this.getPartnerProfile(dto.userId);
  }

  async onboardWarehouse(dto: CreateMarketplaceWarehouseDto, actorId: string) {
    const user = await this.ensureUserRole(dto.userId, UserRole.WAREHOUSE_PARTNER);
    const warehouseIds =
      dto.warehouseIds && dto.warehouseIds.length > 0
        ? dto.warehouseIds
        : await this.getManagedWarehouseIds(dto.userId);
    await this.assertWarehousesExist(warehouseIds);
    const existing = await this.readPartnerRecord(dto.userId);

    const record: MarketplacePartnerRecord = {
      ...(existing ?? {}),
      userId: dto.userId,
      partnerType: 'WAREHOUSE',
      companyName: dto.companyName.trim(),
      serviceAreas: (dto.serviceAreas ?? []).map((value) => value.trim()).filter(Boolean),
      vehicleIds: [],
      warehouseIds: [...new Set(warehouseIds)],
      baseLatitude: dto.baseLatitude ?? null,
      baseLongitude: dto.baseLongitude ?? null,
      serviceRadiusKm: dto.serviceRadiusKm ?? null,
      commissionRatePct:
        dto.commissionRatePct ?? DEFAULT_COMMISSION_RATE_PCT,
      serviceFeeFlat: dto.serviceFeeFlat ?? DEFAULT_SERVICE_FEE_FLAT,
      premiumListing: dto.premiumListing ?? false,
      verificationStatus: 'PENDING_REVIEW',
      verificationNote: 'Awaiting marketplace approval',
      submittedBy: actorId,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      approvedBy: null,
      approvedAt: null,
      rejectedBy: null,
      rejectedAt: null,
      suspendedBy: null,
      suspendedAt: null,
    };

    await this.persistPartnerRecord(record);
    await this.raisePartnerAlert(
      dto.userId,
      `${record.companyName} submitted warehouse onboarding for review.`,
      'MEDIUM',
      {
        partnerType: record.partnerType,
        actorId,
        serviceAreas: record.serviceAreas,
        warehouseIds: record.warehouseIds,
        role: user.role,
      },
    );
    await this.writeAudit(actorId, 'MARKETPLACE_PARTNER_ONBOARDED', dto.userId, {
      partnerType: record.partnerType,
      companyName: record.companyName,
      warehouseIds: record.warehouseIds,
      serviceAreas: record.serviceAreas,
    });

    return this.getPartnerProfile(dto.userId);
  }

  async updatePartnerStatus(
    userId: string,
    dto: UpdateMarketplacePartnerStatusDto,
    actorId: string,
  ) {
    const existing = await this.getPartnerRecordOrThrow(userId);
    const now = new Date().toISOString();

    const updated: MarketplacePartnerRecord = {
      ...existing,
      verificationStatus: dto.status,
      verificationNote: dto.note?.trim() || null,
      updatedAt: now,
      approvedBy: dto.status === 'APPROVED' ? actorId : existing.approvedBy,
      approvedAt: dto.status === 'APPROVED' ? now : existing.approvedAt,
      rejectedBy: dto.status === 'REJECTED' ? actorId : existing.rejectedBy,
      rejectedAt: dto.status === 'REJECTED' ? now : existing.rejectedAt,
      suspendedBy: dto.status === 'SUSPENDED' ? actorId : existing.suspendedBy,
      suspendedAt: dto.status === 'SUSPENDED' ? now : existing.suspendedAt,
    };

    await this.persistPartnerRecord(updated);
    await this.writeAudit(actorId, 'MARKETPLACE_PARTNER_STATUS_UPDATED', userId, {
      previousStatus: existing.verificationStatus,
      nextStatus: dto.status,
      note: dto.note ?? null,
    });

    return this.getPartnerProfile(userId);
  }

  async publishOpportunity(
    bookingId: string,
    dto: PublishMarketplaceOpportunityDto,
    actorId: string,
  ) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        stops: {
          orderBy: { sequence: 'asc' },
        },
      },
    });
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    const publishableStatuses: BookingStatus[] = [
      BookingStatus.CREATED,
      BookingStatus.SEARCHING,
      BookingStatus.APPROVED,
    ];
    if (!publishableStatuses.includes(booking.status)) {
      throw new BadRequestException(
        `Marketplace publish is not allowed for booking status ${booking.status}.`,
      );
    }

    const pricingModel = dto.pricingModel;
    const fixedPrice =
      pricingModel === 'FIXED_PRICE'
        ? this.round(dto.fixedPrice ?? booking.totalPrice)
        : null;
    const minimumBid =
      pricingModel !== 'FIXED_PRICE'
        ? this.round(dto.minimumBid ?? Math.max(0, booking.totalPrice * 0.75))
        : null;

    const partnerType =
      dto.partnerType ?? this.resolveDefaultPartnerType(booking.serviceType);
    const now = new Date();
    const existing = await this.readOpportunityRecord(bookingId);
    const serviceAreaHints = this.buildServiceAreaHints(booking.stops);
    const routeSummary = this.buildRouteSummary(booking.stops, serviceAreaHints);
    const stopSummary = this.buildStopSummary(booking.stops);
    const fleetRequirements = this.buildFleetRequirements(booking);
    const record: MarketplaceOpportunityRecord = {
      bookingId: booking.id,
      bookingReference: booking.reference,
      serviceType: booking.serviceType,
      partnerType,
      pricingModel,
      status: 'OPEN',
      publishedBy: actorId,
      publishedAt: existing?.publishedAt ?? now.toISOString(),
      updatedAt: now.toISOString(),
      expiresAt: dto.expiresAt ?? null,
      currency: 'KES',
      bookingPrice: booking.totalPrice,
      fixedPrice,
      minimumBid,
      serviceAreaHints,
      stopPoints: booking.stops.map((stop) => ({
        latitude: stop.latitude,
        longitude: stop.longitude,
        areaHint: this.sanitizeAreaLabel(stop.address),
        stopType: stop.stopType,
      })),
      routeSummary,
      stopSummary,
      fleetRequirements,
      bids: [],
      awardedPartnerId: null,
      selectedBidId: null,
      awardedAt: null,
      awardedBy: null,
      commissionAmount: null,
      commissionRatePct: null,
      serviceFeeFlat: null,
      premiumListingFee: null,
      partnerNetAmount: null,
    };

    await this.persistOpportunityRecord(record);

    if (booking.status === BookingStatus.CREATED) {
      await this.prisma.booking.update({
        where: { id: booking.id },
        data: { status: BookingStatus.SEARCHING },
      });
    }

    await this.writeAudit(actorId, 'MARKETPLACE_OPPORTUNITY_PUBLISHED', booking.id, {
      bookingReference: booking.reference,
      pricingModel,
      partnerType,
      fixedPrice,
      minimumBid,
      expiresAt: dto.expiresAt ?? null,
    });

    const opportunities = await this.hydrateOpportunities([record]);
    return opportunities[0];
  }

  async listPartnerOpportunities(userId: string) {
    const partner = await this.getPartnerProfile(userId);
    if (partner.verificationStatus !== 'APPROVED') {
      throw new BadRequestException(
        'Marketplace partner must be approved before accepting bookings.',
      );
    }

    const opportunities = await this.readOpportunityRecords();
    const open = opportunities.filter((opportunity) => this.isOpportunityOpen(opportunity));
    const matching = open.filter((opportunity) =>
      this.partnerMatchesOpportunity(partner, opportunity),
    );
    const hydrated = await this.hydrateOpportunities(matching);

    return {
      partner,
      opportunities: hydrated.map((opportunity) =>
        this.toPartnerOpportunityView(opportunity, userId),
      ),
      total: matching.length,
    };
  }

  async acceptOpportunity(bookingId: string, userId: string) {
    const partner = await this.getPartnerProfile(userId);
    const opportunity = await this.getOpportunityRecordOrThrow(bookingId);
    if (opportunity.pricingModel !== 'FIXED_PRICE') {
      throw new BadRequestException(
        'Only fixed-price marketplace opportunities can be accepted directly.',
      );
    }
    if (!this.isOpportunityOpen(opportunity)) {
      throw new BadRequestException('Marketplace opportunity is no longer open.');
    }
    if (!this.partnerMatchesOpportunity(partner, opportunity)) {
      throw new BadRequestException(
        'This marketplace opportunity is outside the partner coverage area.',
      );
    }

    const bid: MarketplaceBidRecord = {
      id: `bid_${Date.now()}`,
      partnerId: userId,
      amount: this.round(opportunity.fixedPrice ?? opportunity.bookingPrice),
      note: 'Accepted at fixed marketplace rate',
      submittedAt: new Date().toISOString(),
      status: 'ACCEPTED',
      counterAmount: null,
      respondedAt: new Date().toISOString(),
      respondedBy: userId,
    };

    return this.awardOpportunity(opportunity, partner, bid, userId);
  }

  async submitBid(bookingId: string, userId: string, dto: MarketplaceBidDto) {
    const partner = await this.getPartnerProfile(userId);
    const opportunity = await this.getOpportunityRecordOrThrow(bookingId);

    if (!this.isOpportunityOpen(opportunity)) {
      throw new BadRequestException('Marketplace opportunity is no longer open.');
    }
    if (opportunity.pricingModel === 'FIXED_PRICE') {
      throw new BadRequestException(
        'Use the accept endpoint for fixed-price marketplace opportunities.',
      );
    }
    if (!this.partnerMatchesOpportunity(partner, opportunity)) {
      throw new BadRequestException(
        'This marketplace opportunity is outside the partner coverage area.',
      );
    }
    if (
      opportunity.minimumBid != null &&
      dto.amount < opportunity.minimumBid
    ) {
      throw new BadRequestException(
        `Bid amount must be at least ${opportunity.minimumBid.toFixed(2)} KES.`,
      );
    }

    const existingBid = opportunity.bids.find(
      (bid) =>
        bid.partnerId === userId &&
        ['PENDING', 'COUNTERED'].includes(bid.status),
    );
    const nextBid: MarketplaceBidRecord = existingBid
      ? {
          ...existingBid,
          amount: this.round(dto.amount),
          note: dto.note?.trim() || null,
          submittedAt: new Date().toISOString(),
          status: 'PENDING',
          counterAmount: null,
          respondedAt: null,
          respondedBy: null,
        }
      : {
          id: `bid_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
          partnerId: userId,
          amount: this.round(dto.amount),
          note: dto.note?.trim() || null,
          submittedAt: new Date().toISOString(),
          status: 'PENDING',
          counterAmount: null,
          respondedAt: null,
          respondedBy: null,
        };

    const bids = existingBid
      ? opportunity.bids.map((bid) => (bid.id === existingBid.id ? nextBid : bid))
      : [...opportunity.bids, nextBid];

    const updated: MarketplaceOpportunityRecord = {
      ...opportunity,
      bids,
      updatedAt: new Date().toISOString(),
    };

    await this.persistOpportunityRecord(updated);
    await this.writeAudit(userId, 'MARKETPLACE_BID_SUBMITTED', bookingId, {
      bidId: nextBid.id,
      amount: nextBid.amount,
      pricingModel: opportunity.pricingModel,
    });

    const hydrated = await this.hydrateOpportunities([updated]);
    return this.toPartnerOpportunityView(hydrated[0], userId);
  }

  async respondToBid(
    bookingId: string,
    bidId: string,
    dto: RespondMarketplaceBidDto,
    actorId: string,
  ) {
    const opportunity = await this.getOpportunityRecordOrThrow(bookingId);
    const bid = opportunity.bids.find((item) => item.id === bidId);
    if (!bid) {
      throw new NotFoundException('Marketplace bid not found');
    }

    const partner = await this.getPartnerRecordOrThrow(bid.partnerId);

    if (dto.action === 'COUNTER') {
      if (dto.counterAmount == null) {
        throw new BadRequestException('counterAmount is required for COUNTER.');
      }
      const updated: MarketplaceOpportunityRecord = {
        ...opportunity,
        bids: opportunity.bids.map((item) =>
          item.id === bidId
            ? {
                ...item,
                status: 'COUNTERED',
                counterAmount: this.round(dto.counterAmount),
                note: dto.note?.trim() || item.note,
                respondedAt: new Date().toISOString(),
                respondedBy: actorId,
              }
            : item,
        ),
        updatedAt: new Date().toISOString(),
      };

      await this.persistOpportunityRecord(updated);
      await this.writeAudit(actorId, 'MARKETPLACE_BID_COUNTERED', bookingId, {
        bidId,
        partnerId: bid.partnerId,
        counterAmount: dto.counterAmount,
      });

      return (await this.hydrateOpportunities([updated]))[0];
    }

    if (dto.action === 'REJECT') {
      const updated: MarketplaceOpportunityRecord = {
        ...opportunity,
        bids: opportunity.bids.map((item) =>
          item.id === bidId
            ? {
                ...item,
                status: 'REJECTED',
                note: dto.note?.trim() || item.note,
                respondedAt: new Date().toISOString(),
                respondedBy: actorId,
              }
            : item,
        ),
        updatedAt: new Date().toISOString(),
      };

      await this.persistOpportunityRecord(updated);
      await this.writeAudit(actorId, 'MARKETPLACE_BID_REJECTED', bookingId, {
        bidId,
        partnerId: bid.partnerId,
      });

      return (await this.hydrateOpportunities([updated]))[0];
    }

    return this.awardOpportunity(
      opportunity,
      partner,
      {
        ...bid,
        status: 'ACCEPTED',
        respondedAt: new Date().toISOString(),
        respondedBy: actorId,
      },
      actorId,
    );
  }

  async monitorPartners() {
    const records = await this.readPartnerRecords();
    const scorecards = await this.buildPerformanceScorecards(records);

    for (const score of scorecards) {
      if (score.statusRecommendation !== 'MAINTAIN') {
        await this.raisePerformanceAlert(score);
      }
    }

    return {
      generatedAt: new Date().toISOString(),
      scorecards,
      notes: [
        'Performance score combines bid conversion, completion rate, on-time execution, and fraud penalties for marketplace-awarded work.',
        'Suspension remains an explicit admin action, but low-score partners now surface a marketplace performance alert for review.',
      ],
    };
  }

  private async awardOpportunity(
    opportunity: MarketplaceOpportunityRecord,
    partner: MarketplacePartnerRecord,
    acceptedBid: MarketplaceBidRecord,
    actorId: string,
  ) {
    if (!this.isOpportunityOpen(opportunity)) {
      throw new BadRequestException('Marketplace opportunity is no longer open.');
    }

    const commission = this.calculateCommission(acceptedBid.amount, partner);
    const updated: MarketplaceOpportunityRecord = {
      ...opportunity,
      status: 'AWARDED',
      bids: opportunity.bids
        .map((bid) =>
          bid.id === acceptedBid.id
            ? acceptedBid
            : ({
                ...bid,
                status: 'REJECTED' as MarketplaceBidStatus,
                respondedAt: bid.respondedAt ?? new Date().toISOString(),
                respondedBy: bid.respondedBy ?? actorId,
              } satisfies MarketplaceBidRecord),
        )
        .concat(
        opportunity.bids.some((bid) => bid.id === acceptedBid.id) ? [] : [acceptedBid],
        ),
      awardedPartnerId: partner.userId,
      selectedBidId: acceptedBid.id,
      awardedAt: new Date().toISOString(),
      awardedBy: actorId,
      updatedAt: new Date().toISOString(),
      commissionAmount: commission.total,
      commissionRatePct: commission.commissionRatePct,
      serviceFeeFlat: commission.serviceFeeFlat,
      premiumListingFee: commission.premiumListingFee,
      partnerNetAmount: commission.partnerNetAmount,
    };

    await this.persistOpportunityRecord(updated);
    await this.prisma.booking.update({
      where: { id: opportunity.bookingId },
      data: {
        status: BookingStatus.APPROVED,
      },
    });
    await this.writeAudit(actorId, 'MARKETPLACE_OPPORTUNITY_AWARDED', opportunity.bookingId, {
      bookingReference: opportunity.bookingReference,
      partnerId: partner.userId,
      bidId: acceptedBid.id,
      amount: acceptedBid.amount,
      commissionAmount: commission.total,
      partnerNetAmount: commission.partnerNetAmount,
    });

    return (await this.hydrateOpportunities([updated]))[0];
  }

  private async buildPerformanceScorecards(
    records: MarketplacePartnerRecord[],
  ): Promise<PartnerPerformance[]> {
    if (records.length === 0) {
      return [];
    }

    const opportunities = await this.readOpportunityRecords();
    const awardedByPartner = new Map<string, MarketplaceOpportunityRecord[]>();
    const bidsByPartner = new Map<string, number>();

    for (const opportunity of opportunities) {
      for (const bid of opportunity.bids) {
        bidsByPartner.set(
          bid.partnerId,
          (bidsByPartner.get(bid.partnerId) ?? 0) + 1,
        );
      }

      if (opportunity.awardedPartnerId) {
        const existing = awardedByPartner.get(opportunity.awardedPartnerId) ?? [];
        existing.push(opportunity);
        awardedByPartner.set(opportunity.awardedPartnerId, existing);
      }
    }

    const bookingIds = [
      ...new Set(
        opportunities
          .filter((opportunity) => opportunity.awardedPartnerId)
          .map((opportunity) => opportunity.bookingId),
      ),
    ];
    const [bookings, alerts, fraudFlags] = await Promise.all([
      bookingIds.length > 0
        ? this.prisma.booking.findMany({
            where: { id: { in: bookingIds } },
            select: {
              id: true,
              status: true,
            },
          })
        : Promise.resolve([]),
      bookingIds.length > 0
        ? this.prisma.internalAlert.findMany({
            where: {
              entityType: 'BOOKING',
              entityId: { in: bookingIds },
              type: { in: ['DELAY', 'SLA_BREACH', 'SLA_NO_SHOW'] },
            },
            select: {
              entityId: true,
            },
          })
        : Promise.resolve([]),
      bookingIds.length > 0
        ? this.prisma.fraudFlag.findMany({
            where: {
              entityType: 'BOOKING',
              entityId: { in: bookingIds },
              status: { in: ['OPEN', 'CONFIRMED'] },
            },
            select: {
              entityId: true,
            },
          })
        : Promise.resolve([]),
    ]);

    const bookingMap = new Map(bookings.map((booking) => [booking.id, booking]));
    const delayedIds = new Set(alerts.map((alert) => alert.entityId));
    const fraudIds = new Set(fraudFlags.map((flag) => flag.entityId));

    return records.map((record) => {
      const awarded = awardedByPartner.get(record.userId) ?? [];
      const completed = awarded.filter((opportunity) => {
        const booking = bookingMap.get(opportunity.bookingId);
        return (
          booking?.status === BookingStatus.DELIVERED ||
          booking?.status === BookingStatus.COMPLETED
        );
      }).length;
      const cancelled = awarded.filter((opportunity) => {
        const booking = bookingMap.get(opportunity.bookingId);
        return (
          booking?.status === BookingStatus.CANCELLED ||
          booking?.status === BookingStatus.REJECTED
        );
      }).length;
      const openTransactions = awarded.filter((opportunity) => {
        const booking = bookingMap.get(opportunity.bookingId);
        return (
          booking != null &&
          ![
            BookingStatus.DELIVERED,
            BookingStatus.COMPLETED,
            BookingStatus.CANCELLED,
            BookingStatus.REJECTED,
          ].includes(booking.status)
        );
      }).length;
      const delayedTransactions = awarded.filter((opportunity) =>
        delayedIds.has(opportunity.bookingId),
      ).length;
      const fraudIncidents = awarded.filter((opportunity) =>
        fraudIds.has(opportunity.bookingId),
      ).length;
      const bidCount = bidsByPartner.get(record.userId) ?? 0;

      const acceptanceRate = this.percent(awarded.length, Math.max(bidCount, awarded.length));
      const completionRate = this.percent(completed, Math.max(awarded.length, 1));
      const onTimeRate = this.percent(
        Math.max(completed - delayedTransactions, 0),
        Math.max(completed, 1),
      );
      const score = Math.max(
        0,
        this.round(
          acceptanceRate * 0.2 +
            completionRate * 0.45 +
            onTimeRate * 0.35 -
            fraudIncidents * 10,
        ),
      );

      return {
        partnerId: record.userId,
        partnerType: record.partnerType,
        verificationStatus: record.verificationStatus,
        companyName: record.companyName,
        awardedTransactions: awarded.length,
        completedTransactions: completed,
        cancelledTransactions: cancelled,
        openTransactions,
        delayedTransactions,
        fraudIncidents,
        bidCount,
        acceptanceRate,
        completionRate,
        onTimeRate,
        performanceScore: score,
        statusRecommendation:
          record.verificationStatus === 'SUSPENDED'
            ? 'SUSPEND'
            : score < LOW_PERFORMANCE_THRESHOLD || fraudIncidents >= 2
              ? 'REVIEW'
              : 'MAINTAIN',
      };
    });
  }

  private async hydratePartners(
    records: MarketplacePartnerRecord[],
    performanceMap: Map<string, PartnerPerformance>,
  ): Promise<PartnerHydrated[]> {
    if (records.length === 0) {
      return [];
    }

    const userIds = records.map((record) => record.userId);
    const vehicleIds = [...new Set(records.flatMap((record) => record.vehicleIds))];
    const warehouseIds = [...new Set(records.flatMap((record) => record.warehouseIds))];

    const [users, vehicles, warehouses] = await Promise.all([
      this.prisma.user.findMany({
        where: { id: { in: userIds } },
        select: {
          id: true,
          fullName: true,
          email: true,
          phone: true,
          role: true,
          status: true,
          agencyId: true,
        },
      }),
      vehicleIds.length > 0
        ? this.prisma.vehicle.findMany({
            where: { id: { in: vehicleIds } },
            select: {
              id: true,
              plateNumber: true,
              type: true,
              status: true,
              capacityKg: true,
              capacityM3: true,
            },
          })
        : Promise.resolve([]),
      warehouseIds.length > 0
        ? this.prisma.warehouse.findMany({
            where: { id: { in: warehouseIds } },
            select: {
              id: true,
              name: true,
              code: true,
              status: true,
              address: true,
            },
          })
        : Promise.resolve([]),
    ]);

    const userMap = new Map(users.map((user) => [user.id, user]));
    const vehicleMap = new Map(vehicles.map((vehicle) => [vehicle.id, vehicle]));
    const warehouseMap = new Map(
      warehouses.map((warehouse) => [warehouse.id, warehouse]),
    );

    return records.map((record) => ({
      ...record,
      user: userMap.get(record.userId) ?? null,
      linkedVehicles: record.vehicleIds
        .map((vehicleId) => vehicleMap.get(vehicleId))
        .filter((vehicle): vehicle is NonNullable<typeof vehicle> => Boolean(vehicle)),
      linkedWarehouses: record.warehouseIds
        .map((warehouseId) => warehouseMap.get(warehouseId))
        .filter(
          (warehouse): warehouse is NonNullable<typeof warehouse> => Boolean(warehouse),
        ),
      performance: performanceMap.get(record.userId) ?? null,
    }));
  }

  private async hydrateOpportunities(
    records: MarketplaceOpportunityRecord[],
  ): Promise<OpportunityHydrated[]> {
    if (records.length === 0) {
      return [];
    }

    const allPartnerRecords = await this.readPartnerRecords();
    const scorecards = await this.buildPerformanceScorecards(allPartnerRecords);
    const performanceMap = new Map(
      scorecards.map((score) => [score.partnerId, score]),
    );
    const bookingIds = records.map((record) => record.bookingId);

    const [partners, bookings] = await Promise.all([
      this.hydratePartners(allPartnerRecords, performanceMap),
      this.prisma.booking.findMany({
        where: { id: { in: bookingIds } },
        include: {
          stops: {
            orderBy: { sequence: 'asc' },
            select: {
              sequence: true,
              address: true,
              latitude: true,
              longitude: true,
              stopType: true,
            },
          },
        },
      }),
    ]);

    const customerIds = [...new Set(bookings.map((booking) => booking.customerId))];
    const customers =
      customerIds.length > 0
        ? await this.prisma.user.findMany({
            where: { id: { in: customerIds } },
            select: {
              id: true,
              fullName: true,
              email: true,
              phone: true,
            },
          })
        : [];

    const partnerMap = new Map(partners.map((partner) => [partner.userId, partner]));
    const bookingMap = new Map(bookings.map((booking) => [booking.id, booking]));
    const customerMap = new Map(customers.map((customer) => [customer.id, customer]));

    return records.map((record) => {
      const booking = bookingMap.get(record.bookingId) ?? null;
      const matchedPartnerIds = partners
        .filter((partner) => this.partnerMatchesOpportunity(partner, record))
        .map((partner) => partner.userId);

      return {
        ...record,
        booking: booking
          ? {
              id: booking.id,
              reference: booking.reference,
              status: booking.status,
              serviceType: booking.serviceType,
              totalPrice: booking.totalPrice,
              customerId: booking.customerId,
              customerLabel:
                customerMap.get(booking.customerId)?.fullName ??
                customerMap.get(booking.customerId)?.email ??
                customerMap.get(booking.customerId)?.phone ??
                booking.customerId,
              stops: booking.stops,
            }
          : null,
        awardedPartner: record.awardedPartnerId
          ? partnerMap.get(record.awardedPartnerId) ?? null
          : null,
        bidsDetailed: record.bids.map((bid) => ({
          ...bid,
          partner: partnerMap.get(bid.partnerId) ?? null,
        })),
        matchedPartnerIds,
      };
    });
  }

  private toPartnerOpportunityView(
    opportunity: OpportunityHydrated,
    viewerId: string,
  ): PartnerOpportunityView {
    const myBid = opportunity.bids.find((bid) => bid.partnerId === viewerId) ?? null;

    return {
      bookingId: opportunity.bookingId,
      bookingReference: opportunity.bookingReference,
      serviceType: opportunity.serviceType,
      partnerType: opportunity.partnerType,
      pricingModel: opportunity.pricingModel,
      status: opportunity.status,
      publishedAt: opportunity.publishedAt,
      expiresAt: opportunity.expiresAt,
      currency: opportunity.currency,
      bookingPrice: opportunity.bookingPrice,
      fixedPrice: opportunity.fixedPrice,
      minimumBid: opportunity.minimumBid,
      serviceAreaHints: opportunity.serviceAreaHints,
      routeSummary: opportunity.routeSummary,
      stopSummary: opportunity.stopSummary,
      fleetRequirements: opportunity.fleetRequirements,
      myBid: myBid
        ? {
            id: myBid.id,
            amount: myBid.amount,
            note: myBid.note,
            submittedAt: myBid.submittedAt,
            status: myBid.status,
            counterAmount: myBid.counterAmount,
            respondedAt: myBid.respondedAt,
          }
        : null,
      visibility: 'REQUIREMENTS_ONLY',
    };
  }

  private buildServiceAreaHints(
    stops: Array<{ address: string }>,
  ): string[] {
    return [...new Set(
      stops
        .map((stop) => this.sanitizeAreaLabel(stop.address))
        .filter((value): value is string => Boolean(value)),
    )];
  }

  private buildRouteSummary(
    stops: Array<{ address: string }>,
    areaHints: string[],
  ): OpportunityRouteSummary {
    const pickupArea = areaHints[0] ?? null;
    const deliveryArea =
      areaHints.length > 1 ? areaHints[areaHints.length - 1] : pickupArea;
    const viaAreas =
      areaHints.length > 2 ? areaHints.slice(1, -1) : [];
    const summary =
      pickupArea && deliveryArea
        ? pickupArea === deliveryArea
          ? pickupArea
          : `${pickupArea} -> ${deliveryArea}`
        : areaHints[0] ??
          this.sanitizeAreaLabel(stops[0]?.address ?? '') ??
          'Route requirements';

    return {
      pickupArea,
      deliveryArea,
      viaAreas,
      summary,
    };
  }

  private buildStopSummary(
    stops: Array<{ stopType: string }>,
  ): OpportunityStopSummary {
    return stops.reduce<OpportunityStopSummary>(
      (summary, stop) => {
        const normalized = String(stop.stopType ?? '').toUpperCase();
        summary.totalStops += 1;
        if (normalized === 'PICKUP' || normalized === 'LOAD') {
          summary.pickupStops += 1;
        } else if (normalized === 'DELIVERY' || normalized === 'UNLOAD') {
          summary.deliveryStops += 1;
        } else {
          summary.intermediateStops += 1;
        }
        return summary;
      },
      {
        totalStops: 0,
        pickupStops: 0,
        deliveryStops: 0,
        intermediateStops: 0,
      },
    );
  }

  private buildFleetRequirements(booking: {
    requiredVehicleType: VehicleType | null;
    cargoWeightKg: number | null;
    cargoType: string | null;
    estimatedDistKm: number;
    isScheduled: boolean;
    tradeMode: string | null;
    railCorridorCode: string | null;
    pacReady: boolean;
    serviceType: ServiceType;
  }): OpportunityFleetRequirements {
    const specialHandling = [
      booking.isScheduled ? 'SCHEDULED' : null,
      booking.tradeMode ? `TRADE:${booking.tradeMode}` : null,
      booking.railCorridorCode ? `RAIL:${booking.railCorridorCode}` : null,
      booking.pacReady ? 'PAC_READY' : null,
      booking.serviceType === ServiceType.WAREHOUSE ? 'WAREHOUSE_FLOW' : null,
    ].filter((value): value is string => Boolean(value));

    return {
      vehicleType: booking.requiredVehicleType ?? null,
      minimumCapacityKg:
        booking.cargoWeightKg != null ? this.round(booking.cargoWeightKg) : null,
      minimumCapacityM3: null,
      cargoType: booking.cargoType?.trim() || null,
      cargoWeightKg:
        booking.cargoWeightKg != null ? this.round(booking.cargoWeightKg) : null,
      estimatedDistanceKm:
        booking.estimatedDistKm != null ? this.round(booking.estimatedDistKm) : null,
      specialHandling,
    };
  }

  private sanitizeAreaLabel(address: string | null | undefined) {
    const raw = String(address ?? '').trim().replace(/\s+/g, ' ');
    if (!raw) {
      return null;
    }

    const parts = raw
      .split(/[,;\n]+/)
      .map((part) => part.trim())
      .filter(Boolean);

    if (parts.length >= 2) {
      return parts.slice(-2).join(', ');
    }

    const words = raw.split(/\s+/).filter(Boolean);
    const genericTokens = new Set([
      'road',
      'rd',
      'street',
      'st',
      'avenue',
      'ave',
      'highway',
      'lane',
      'drive',
      'building',
      'block',
      'plot',
      'house',
      'apartment',
      'suite',
      'floor',
      'gate',
      'shop',
      'office',
      'room',
    ]);
    const filtered = words.filter((word) => {
      const normalized = word.toLowerCase().replace(/[^a-z0-9]/g, '');
      return normalized && !/\d/.test(normalized) && !genericTokens.has(normalized);
    });

    if (filtered.length >= 2) {
      return filtered.slice(-2).join(' ');
    }

    return filtered.join(' ') || raw;
  }

  private calculateCommission(amount: number, partner: MarketplacePartnerRecord) {
    const commissionRatePct = partner.commissionRatePct;
    const serviceFeeFlat = partner.serviceFeeFlat;
    const premiumListingFee = partner.premiumListing
      ? DEFAULT_PREMIUM_LISTING_FEE
      : 0;
    const percentageCommission = this.round((amount * commissionRatePct) / 100);
    const total = this.round(
      percentageCommission + serviceFeeFlat + premiumListingFee,
    );

    return {
      commissionRatePct,
      serviceFeeFlat,
      premiumListingFee,
      total,
      partnerNetAmount: this.round(Math.max(amount - total, 0)),
    };
  }

  private partnerMatchesOpportunity(
    partner: Pick<
      MarketplacePartnerRecord,
      | 'partnerType'
      | 'serviceAreas'
      | 'baseLatitude'
      | 'baseLongitude'
      | 'serviceRadiusKm'
      | 'verificationStatus'
    > & {
      linkedVehicles?: Array<{
        type: VehicleType;
        status: VehicleStatus;
        capacityKg: number;
        capacityM3: number | null;
      }>;
    },
    opportunity: Pick<
      MarketplaceOpportunityRecord,
      | 'partnerType'
      | 'serviceAreaHints'
      | 'stopPoints'
      | 'status'
      | 'expiresAt'
      | 'fleetRequirements'
    >,
  ) {
    if (partner.verificationStatus !== 'APPROVED') {
      return false;
    }
    if (partner.partnerType !== opportunity.partnerType) {
      return false;
    }
    if (!this.isOpportunityOpen(opportunity)) {
      return false;
    }
    if (!this.partnerSupportsFleetRequirement(partner, opportunity.fleetRequirements)) {
      return false;
    }

    const normalizedAreas = partner.serviceAreas.map((value) =>
      value.trim().toLowerCase(),
    );
    const hintMatch =
      normalizedAreas.length > 0 &&
      opportunity.serviceAreaHints.some((hint) => {
        const normalizedHint = hint.toLowerCase();
        return normalizedAreas.some(
          (area) => normalizedHint.includes(area) || area.includes(normalizedHint),
        );
      });

    if (hintMatch) {
      return true;
    }

    if (
      partner.baseLatitude == null ||
      partner.baseLongitude == null ||
      partner.serviceRadiusKm == null
    ) {
      return false;
    }

    return opportunity.stopPoints.some((stop) => {
      const distance = this.haversineKm(
        partner.baseLatitude ?? 0,
        partner.baseLongitude ?? 0,
        stop.latitude,
        stop.longitude,
      );
      return distance <= (partner.serviceRadiusKm ?? 0);
    });
  }

  private partnerSupportsFleetRequirement(
    partner: Pick<MarketplacePartnerRecord, 'partnerType'> & {
      linkedVehicles?: Array<{
        type: VehicleType;
        status: VehicleStatus;
        capacityKg: number;
        capacityM3: number | null;
      }>;
    },
    fleetRequirements: OpportunityFleetRequirements,
  ) {
    if (
      partner.partnerType !== 'TRANSPORTER' &&
      partner.partnerType !== 'COURIER_COMPANY'
    ) {
      return true;
    }

    const vehicles = (partner.linkedVehicles ?? []).filter(
      (vehicle) =>
        vehicle.status === VehicleStatus.ACTIVE ||
        vehicle.status === VehicleStatus.INACTIVE,
    );

    if (vehicles.length === 0) {
      return false;
    }

    return vehicles.some((vehicle) => {
      if (
        fleetRequirements.vehicleType &&
        vehicle.type !== fleetRequirements.vehicleType
      ) {
        return false;
      }
      if (
        fleetRequirements.minimumCapacityKg != null &&
        vehicle.capacityKg < fleetRequirements.minimumCapacityKg
      ) {
        return false;
      }
      if (
        fleetRequirements.minimumCapacityM3 != null &&
        (vehicle.capacityM3 ?? 0) < fleetRequirements.minimumCapacityM3
      ) {
        return false;
      }
      return true;
    });
  }

  private isOpportunityOpen(
    opportunity: Pick<MarketplaceOpportunityRecord, 'status' | 'expiresAt'>,
  ) {
    if (opportunity.status !== 'OPEN') {
      return false;
    }
    if (opportunity.expiresAt && new Date(opportunity.expiresAt) < new Date()) {
      return false;
    }
    return true;
  }

  private async ensureUserRole(userId: string, role: UserRole) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        status: true,
      },
    });
    if (!user) {
      throw new NotFoundException('Partner user not found');
    }
    if (user.role !== role) {
      throw new BadRequestException(
        `Marketplace onboarding requires a ${role} account.`,
      );
    }
    if (user.status !== AccountStatus.ACTIVE) {
      throw new BadRequestException(
        'Partner account must be ACTIVE before marketplace onboarding.',
      );
    }
    return user;
  }

  private async assertVehiclesExist(vehicleIds: string[]) {
    if (vehicleIds.length === 0) {
      return;
    }

    const vehicles = await this.prisma.vehicle.findMany({
      where: { id: { in: vehicleIds } },
      select: { id: true },
    });
    if (vehicles.length !== vehicleIds.length) {
      throw new BadRequestException('One or more vehicle IDs were not found.');
    }
  }

  private async assertWarehousesExist(warehouseIds: string[]) {
    if (warehouseIds.length === 0) {
      return;
    }

    const warehouses = await this.prisma.warehouse.findMany({
      where: { id: { in: warehouseIds } },
      select: { id: true },
    });
    if (warehouses.length !== warehouseIds.length) {
      throw new BadRequestException('One or more warehouse IDs were not found.');
    }
  }

  private async getManagedWarehouseIds(userId: string) {
    const warehouses = await this.prisma.warehouse.findMany({
      where: { managerId: userId },
      select: { id: true },
    });
    return warehouses.map((warehouse) => warehouse.id);
  }

  private async getPartnerRecordOrThrow(userId: string) {
    const record = await this.readPartnerRecord(userId);
    if (!record) {
      throw new NotFoundException('Marketplace partner record not found');
    }
    return record;
  }

  private async getOpportunityRecordOrThrow(bookingId: string) {
    const record = await this.readOpportunityRecord(bookingId);
    if (!record) {
      throw new NotFoundException('Marketplace opportunity not found');
    }
    return record;
  }

  private async readPartnerRecords() {
    const rows = await this.prisma.idempotencyRecord.findMany({
      where: {
        key: { startsWith: PARTNER_PREFIX },
      },
      select: {
        response: true,
      },
      orderBy: { updatedAt: 'desc' },
    });

    return rows
      .map((row) => this.asPartnerRecord(row.response))
      .filter((record): record is MarketplacePartnerRecord => Boolean(record));
  }

  private async readOpportunityRecords() {
    const rows = await this.prisma.idempotencyRecord.findMany({
      where: {
        key: { startsWith: OPPORTUNITY_PREFIX },
      },
      select: {
        response: true,
      },
      orderBy: { updatedAt: 'desc' },
    });

    return rows
      .map((row) => this.asOpportunityRecord(row.response))
      .filter(
        (record): record is MarketplaceOpportunityRecord => Boolean(record),
      );
  }

  private async readPartnerRecord(userId: string) {
    const row = await this.prisma.idempotencyRecord.findUnique({
      where: { key: this.partnerKey(userId) },
      select: { response: true },
    });
    return this.asPartnerRecord(row?.response);
  }

  private async readOpportunityRecord(bookingId: string) {
    const row = await this.prisma.idempotencyRecord.findUnique({
      where: { key: this.opportunityKey(bookingId) },
      select: { response: true },
    });
    return this.asOpportunityRecord(row?.response);
  }

  private async persistPartnerRecord(record: MarketplacePartnerRecord) {
    await this.prisma.idempotencyRecord.upsert({
      where: { key: this.partnerKey(record.userId) },
      create: {
        key: this.partnerKey(record.userId),
        status: record.verificationStatus,
        requestHash: record.userId,
        response: record as Prisma.InputJsonValue,
      },
      update: {
        status: record.verificationStatus,
        requestHash: record.userId,
        response: record as Prisma.InputJsonValue,
      },
    });
  }

  private async persistOpportunityRecord(record: MarketplaceOpportunityRecord) {
    await this.prisma.idempotencyRecord.upsert({
      where: { key: this.opportunityKey(record.bookingId) },
      create: {
        key: this.opportunityKey(record.bookingId),
        status: record.status,
        requestHash: record.bookingId,
        response: record as Prisma.InputJsonValue,
      },
      update: {
        status: record.status,
        requestHash: record.bookingId,
        response: record as Prisma.InputJsonValue,
      },
    });
  }

  private async raisePartnerAlert(
    entityId: string,
    message: string,
    severity: string,
    metadata: Record<string, unknown>,
  ) {
    const existing = await this.prisma.internalAlert.findFirst({
      where: {
        type: 'MARKETPLACE_PARTNER_REVIEW',
        entityType: 'MARKETPLACE_PARTNER',
        entityId,
        status: { not: 'RESOLVED' },
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true, metadata: true },
    });

    const nextMetadata = {
      ...(existing?.metadata && typeof existing.metadata === 'object'
        ? (existing.metadata as Record<string, unknown>)
        : {}),
      ...metadata,
      updatedAt: new Date().toISOString(),
    } as Prisma.InputJsonValue;

    if (existing) {
      await this.prisma.internalAlert.update({
        where: { id: existing.id },
        data: {
          severity,
          message,
          metadata: nextMetadata,
        },
      });
      return;
    }

    await this.prisma.internalAlert.create({
      data: {
        type: 'MARKETPLACE_PARTNER_REVIEW',
        severity,
        message,
        status: 'PENDING',
        agencyId: null,
        entityType: 'MARKETPLACE_PARTNER',
        entityId,
        metadata: nextMetadata,
      },
    });
  }

  private async raisePerformanceAlert(score: PartnerPerformance) {
    const existing = await this.prisma.internalAlert.findFirst({
      where: {
        type: 'MARKETPLACE_PARTNER_PERFORMANCE',
        entityType: 'MARKETPLACE_PARTNER',
        entityId: score.partnerId,
        status: { not: 'RESOLVED' },
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });

    const message =
      score.statusRecommendation === 'SUSPEND'
        ? `${score.companyName} should remain suspended or blocked from awards until marketplace performance recovers.`
        : `${score.companyName} needs marketplace review after a performance score of ${score.performanceScore}.`;

    const metadata = {
      performanceScore: score.performanceScore,
      acceptanceRate: score.acceptanceRate,
      completionRate: score.completionRate,
      onTimeRate: score.onTimeRate,
      fraudIncidents: score.fraudIncidents,
      updatedAt: new Date().toISOString(),
    } as Prisma.InputJsonValue;

    if (existing) {
      await this.prisma.internalAlert.update({
        where: { id: existing.id },
        data: {
          severity:
            score.statusRecommendation === 'SUSPEND' ? 'HIGH' : 'MEDIUM',
          message,
          metadata,
        },
      });
      return;
    }

    await this.prisma.internalAlert.create({
      data: {
        type: 'MARKETPLACE_PARTNER_PERFORMANCE',
        severity:
          score.statusRecommendation === 'SUSPEND' ? 'HIGH' : 'MEDIUM',
        message,
        status: 'PENDING',
        agencyId: null,
        entityType: 'MARKETPLACE_PARTNER',
        entityId: score.partnerId,
        metadata,
      },
    });
  }

  private async writeAudit(
    userId: string,
    action: string,
    entityId: string,
    details: Record<string, unknown>,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) {
      return;
    }

    await this.prisma.auditLog.create({
      data: {
        userId,
        action,
        entityType: 'MARKETPLACE',
        entityId,
        details: details as Prisma.InputJsonValue,
      },
    });
  }

  private partnerKey(userId: string) {
    return `${PARTNER_PREFIX}${userId}`;
  }

  private opportunityKey(bookingId: string) {
    return `${OPPORTUNITY_PREFIX}${bookingId}`;
  }

  private normalizePartnerType(value: string): MarketplacePartnerType {
    if (value === 'WAREHOUSE') {
      return 'WAREHOUSE';
    }
    if (value === 'AGENT') {
      return 'AGENT';
    }
    if (value === 'COURIER_COMPANY') {
      return 'COURIER_COMPANY';
    }
    return 'TRANSPORTER';
  }

  private resolveDefaultPartnerType(
    serviceType: ServiceType,
  ): MarketplacePartnerType {
    if (serviceType === ServiceType.WAREHOUSE) {
      return 'WAREHOUSE';
    }
    if (serviceType === ServiceType.COURIER) {
      return 'COURIER_COMPANY';
    }
    return 'TRANSPORTER';
  }

  private asPartnerRecord(value: Prisma.JsonValue | null | undefined) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }

    const record = value as Record<string, Prisma.JsonValue>;
    if (
      typeof record.userId !== 'string' ||
      typeof record.partnerType !== 'string' ||
      typeof record.companyName !== 'string'
    ) {
      return null;
    }

    return {
      userId: record.userId,
      partnerType: this.normalizePartnerType(record.partnerType),
      companyName: record.companyName,
      serviceAreas: this.asStringArray(record.serviceAreas),
      vehicleIds: this.asStringArray(record.vehicleIds),
      warehouseIds: this.asStringArray(record.warehouseIds),
      baseLatitude:
        typeof record.baseLatitude === 'number' ? record.baseLatitude : null,
      baseLongitude:
        typeof record.baseLongitude === 'number' ? record.baseLongitude : null,
      serviceRadiusKm:
        typeof record.serviceRadiusKm === 'number' ? record.serviceRadiusKm : null,
      commissionRatePct:
        typeof record.commissionRatePct === 'number'
          ? record.commissionRatePct
          : DEFAULT_COMMISSION_RATE_PCT,
      serviceFeeFlat:
        typeof record.serviceFeeFlat === 'number'
          ? record.serviceFeeFlat
          : DEFAULT_SERVICE_FEE_FLAT,
      premiumListing: Boolean(record.premiumListing),
      verificationStatus:
        typeof record.verificationStatus === 'string'
          ? (record.verificationStatus as MarketplacePartnerStatus)
          : 'PENDING_REVIEW',
      verificationNote:
        typeof record.verificationNote === 'string'
          ? record.verificationNote
          : null,
      submittedBy:
        typeof record.submittedBy === 'string' ? record.submittedBy : record.userId,
      createdAt:
        typeof record.createdAt === 'string'
          ? record.createdAt
          : new Date().toISOString(),
      updatedAt:
        typeof record.updatedAt === 'string'
          ? record.updatedAt
          : new Date().toISOString(),
      approvedBy:
        typeof record.approvedBy === 'string' ? record.approvedBy : null,
      approvedAt:
        typeof record.approvedAt === 'string' ? record.approvedAt : null,
      rejectedBy:
        typeof record.rejectedBy === 'string' ? record.rejectedBy : null,
      rejectedAt:
        typeof record.rejectedAt === 'string' ? record.rejectedAt : null,
      suspendedBy:
        typeof record.suspendedBy === 'string' ? record.suspendedBy : null,
      suspendedAt:
        typeof record.suspendedAt === 'string' ? record.suspendedAt : null,
    } satisfies MarketplacePartnerRecord;
  }

  private asOpportunityRecord(value: Prisma.JsonValue | null | undefined) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }

    const record = value as Record<string, Prisma.JsonValue>;
    if (
      typeof record.bookingId !== 'string' ||
      typeof record.bookingReference !== 'string' ||
      typeof record.status !== 'string'
    ) {
      return null;
    }

    return {
      bookingId: record.bookingId,
      bookingReference: record.bookingReference,
      serviceType:
        typeof record.serviceType === 'string'
          ? (record.serviceType as ServiceType)
          : ServiceType.COURIER,
      partnerType:
        typeof record.partnerType === 'string'
          ? this.normalizePartnerType(record.partnerType)
          : this.resolveDefaultPartnerType(
              typeof record.serviceType === 'string'
                ? (record.serviceType as ServiceType)
                : ServiceType.COURIER,
            ),
      pricingModel:
        typeof record.pricingModel === 'string'
          ? (record.pricingModel as MarketplacePricingModel)
          : 'FIXED_PRICE',
      status: record.status as MarketplaceOpportunityStatus,
      publishedBy:
        typeof record.publishedBy === 'string' ? record.publishedBy : 'system',
      publishedAt:
        typeof record.publishedAt === 'string'
          ? record.publishedAt
          : new Date().toISOString(),
      updatedAt:
        typeof record.updatedAt === 'string'
          ? record.updatedAt
          : new Date().toISOString(),
      expiresAt:
        typeof record.expiresAt === 'string' ? record.expiresAt : null,
      currency: typeof record.currency === 'string' ? record.currency : 'KES',
      bookingPrice:
        typeof record.bookingPrice === 'number' ? record.bookingPrice : 0,
      fixedPrice:
        typeof record.fixedPrice === 'number' ? record.fixedPrice : null,
      minimumBid:
        typeof record.minimumBid === 'number' ? record.minimumBid : null,
      serviceAreaHints: this.asStringArray(record.serviceAreaHints),
      stopPoints: this.asStopPoints(record.stopPoints),
      routeSummary: this.asRouteSummary(record.routeSummary, record.serviceAreaHints),
      stopSummary: this.asStopSummary(record.stopSummary, record.stopPoints),
      fleetRequirements: this.asFleetRequirements(record.fleetRequirements),
      bids: this.asBidArray(record.bids),
      awardedPartnerId:
        typeof record.awardedPartnerId === 'string'
          ? record.awardedPartnerId
          : null,
      selectedBidId:
        typeof record.selectedBidId === 'string' ? record.selectedBidId : null,
      awardedAt:
        typeof record.awardedAt === 'string' ? record.awardedAt : null,
      awardedBy:
        typeof record.awardedBy === 'string' ? record.awardedBy : null,
      commissionAmount:
        typeof record.commissionAmount === 'number'
          ? record.commissionAmount
          : null,
      commissionRatePct:
        typeof record.commissionRatePct === 'number'
          ? record.commissionRatePct
          : null,
      serviceFeeFlat:
        typeof record.serviceFeeFlat === 'number' ? record.serviceFeeFlat : null,
      premiumListingFee:
        typeof record.premiumListingFee === 'number'
          ? record.premiumListingFee
          : null,
      partnerNetAmount:
        typeof record.partnerNetAmount === 'number'
          ? record.partnerNetAmount
          : null,
    } satisfies MarketplaceOpportunityRecord;
  }

  private asStringArray(value: Prisma.JsonValue | null | undefined) {
    if (!Array.isArray(value)) {
      return [];
    }
    return value.filter((item): item is string => typeof item === 'string');
  }

  private asStopPoints(value: Prisma.JsonValue | null | undefined) {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .map((item) => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) {
          return null;
        }
        const record = item as Record<string, Prisma.JsonValue>;
        if (
          typeof record.latitude !== 'number' ||
          typeof record.longitude !== 'number'
        ) {
          return null;
        }
        return {
          latitude: record.latitude,
          longitude: record.longitude,
          areaHint:
            typeof record.areaHint === 'string'
              ? record.areaHint
              : typeof record.address === 'string'
                ? this.sanitizeAreaLabel(record.address)
                : null,
          stopType:
            typeof record.stopType === 'string' ? record.stopType : null,
        };
      })
      .filter((item): item is OpportunityStopPoint =>
        Boolean(item),
      );
  }

  private asRouteSummary(
    value: Prisma.JsonValue | null | undefined,
    fallbackHints: Prisma.JsonValue | null | undefined,
  ): OpportunityRouteSummary {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const record = value as Record<string, Prisma.JsonValue>;
      return {
        pickupArea:
          typeof record.pickupArea === 'string' ? record.pickupArea : null,
        deliveryArea:
          typeof record.deliveryArea === 'string' ? record.deliveryArea : null,
        viaAreas: this.asStringArray(record.viaAreas),
        summary:
          typeof record.summary === 'string'
            ? record.summary
            : this.asStringArray(fallbackHints).join(' -> ') || 'Route requirements',
      };
    }

    const hints = this.asStringArray(fallbackHints);
    const pickupArea = hints[0] ?? null;
    const deliveryArea = hints.length > 1 ? hints[hints.length - 1] : pickupArea;
    return {
      pickupArea,
      deliveryArea,
      viaAreas: hints.length > 2 ? hints.slice(1, -1) : [],
      summary:
        pickupArea && deliveryArea
          ? pickupArea === deliveryArea
            ? pickupArea
            : `${pickupArea} -> ${deliveryArea}`
          : hints.join(' -> ') || 'Route requirements',
    };
  }

  private asStopSummary(
    value: Prisma.JsonValue | null | undefined,
    fallbackStops: Prisma.JsonValue | null | undefined,
  ): OpportunityStopSummary {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const record = value as Record<string, Prisma.JsonValue>;
      return {
        totalStops:
          typeof record.totalStops === 'number' ? record.totalStops : 0,
        pickupStops:
          typeof record.pickupStops === 'number' ? record.pickupStops : 0,
        deliveryStops:
          typeof record.deliveryStops === 'number' ? record.deliveryStops : 0,
        intermediateStops:
          typeof record.intermediateStops === 'number'
            ? record.intermediateStops
            : 0,
      };
    }

    const stops = this.asStopPoints(fallbackStops);
    return this.buildStopSummary(
      stops.map((stop) => ({ stopType: stop.stopType ?? 'INTERMEDIATE' })),
    );
  }

  private asFleetRequirements(
    value: Prisma.JsonValue | null | undefined,
  ): OpportunityFleetRequirements {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const record = value as Record<string, Prisma.JsonValue>;
      return {
        vehicleType: this.asVehicleType(record.vehicleType),
        minimumCapacityKg:
          typeof record.minimumCapacityKg === 'number'
            ? record.minimumCapacityKg
            : null,
        minimumCapacityM3:
          typeof record.minimumCapacityM3 === 'number'
            ? record.minimumCapacityM3
            : null,
        cargoType:
          typeof record.cargoType === 'string' ? record.cargoType : null,
        cargoWeightKg:
          typeof record.cargoWeightKg === 'number'
            ? record.cargoWeightKg
            : null,
        estimatedDistanceKm:
          typeof record.estimatedDistanceKm === 'number'
            ? record.estimatedDistanceKm
            : null,
        specialHandling: this.asStringArray(record.specialHandling),
      };
    }

    return {
      vehicleType: null,
      minimumCapacityKg: null,
      minimumCapacityM3: null,
      cargoType: null,
      cargoWeightKg: null,
      estimatedDistanceKm: null,
      specialHandling: [],
    };
  }

  private asVehicleType(value: Prisma.JsonValue | null | undefined) {
    return typeof value === 'string' &&
      Object.values(VehicleType).includes(value as VehicleType)
      ? (value as VehicleType)
      : null;
  }

  private asBidArray(value: Prisma.JsonValue | null | undefined) {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .map((item) => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) {
          return null;
        }
        const record = item as Record<string, Prisma.JsonValue>;
        if (
          typeof record.id !== 'string' ||
          typeof record.partnerId !== 'string' ||
          typeof record.amount !== 'number'
        ) {
          return null;
        }

        return {
          id: record.id,
          partnerId: record.partnerId,
          amount: record.amount,
          note: typeof record.note === 'string' ? record.note : null,
          submittedAt:
            typeof record.submittedAt === 'string'
              ? record.submittedAt
              : new Date().toISOString(),
          status:
            typeof record.status === 'string'
              ? (record.status as MarketplaceBidStatus)
              : 'PENDING',
          counterAmount:
            typeof record.counterAmount === 'number' ? record.counterAmount : null,
          respondedAt:
            typeof record.respondedAt === 'string' ? record.respondedAt : null,
          respondedBy:
            typeof record.respondedBy === 'string' ? record.respondedBy : null,
        } satisfies MarketplaceBidRecord;
      })
      .filter((item): item is MarketplaceBidRecord => Boolean(item));
  }

  private round(value: number) {
    return Number(value.toFixed(2));
  }

  private percent(part: number, whole: number) {
    if (whole <= 0) {
      return 0;
    }
    return this.round((part / whole) * 100);
  }

  private haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
    const radius = 6371;
    const dLat = this.toRadians(lat2 - lat1);
    const dLng = this.toRadians(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(this.toRadians(lat1)) *
        Math.cos(this.toRadians(lat2)) *
        Math.sin(dLng / 2) ** 2;

    return this.round(
      radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)),
    );
  }

  private toRadians(value: number) {
    return (value * Math.PI) / 180;
  }
}
