-- Dedicated marketplace persistence. Existing IdempotencyRecord snapshots are
-- intentionally left in place as legacy fallback data during rollout.
CREATE TABLE "MarketplacePartner" (
    "userId" TEXT NOT NULL,
    "partnerType" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "serviceAreas" JSONB NOT NULL,
    "vehicleIds" JSONB NOT NULL,
    "warehouseIds" JSONB NOT NULL,
    "baseLatitude" DOUBLE PRECISION,
    "baseLongitude" DOUBLE PRECISION,
    "serviceRadiusKm" DOUBLE PRECISION,
    "commissionRatePct" DOUBLE PRECISION NOT NULL DEFAULT 12,
    "serviceFeeFlat" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "premiumListing" BOOLEAN NOT NULL DEFAULT false,
    "verificationStatus" TEXT NOT NULL DEFAULT 'PENDING_REVIEW',
    "verificationNote" TEXT,
    "submittedBy" TEXT NOT NULL,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectedBy" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "suspendedBy" TEXT,
    "suspendedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MarketplacePartner_pkey" PRIMARY KEY ("userId")
);

CREATE TABLE "MarketplaceOpportunity" (
    "bookingId" TEXT NOT NULL,
    "bookingReference" TEXT NOT NULL,
    "serviceType" "ServiceType" NOT NULL,
    "partnerType" TEXT NOT NULL,
    "pricingModel" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "publishedBy" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "currency" TEXT NOT NULL DEFAULT 'KES',
    "bookingPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "fixedPrice" DOUBLE PRECISION,
    "minimumBid" DOUBLE PRECISION,
    "serviceAreaHints" JSONB NOT NULL,
    "stopPoints" JSONB NOT NULL,
    "routeSummary" JSONB NOT NULL,
    "stopSummary" JSONB NOT NULL,
    "fleetRequirements" JSONB NOT NULL,
    "awardedPartnerId" TEXT,
    "selectedBidId" TEXT,
    "awardedAt" TIMESTAMP(3),
    "awardedBy" TEXT,
    "commissionAmount" DOUBLE PRECISION,
    "commissionRatePct" DOUBLE PRECISION,
    "serviceFeeFlat" DOUBLE PRECISION,
    "premiumListingFee" DOUBLE PRECISION,
    "partnerNetAmount" DOUBLE PRECISION,
    CONSTRAINT "MarketplaceOpportunity_pkey" PRIMARY KEY ("bookingId")
);

CREATE TABLE "MarketplaceBid" (
    "id" TEXT NOT NULL,
    "opportunityBookingId" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "note" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "counterAmount" DOUBLE PRECISION,
    "respondedAt" TIMESTAMP(3),
    "respondedBy" TEXT,
    CONSTRAINT "MarketplaceBid_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MarketplacePartner_partnerType_verificationStatus_idx" ON "MarketplacePartner"("partnerType", "verificationStatus");
CREATE INDEX "MarketplacePartner_updatedAt_idx" ON "MarketplacePartner"("updatedAt");
CREATE INDEX "MarketplaceOpportunity_partnerType_status_idx" ON "MarketplaceOpportunity"("partnerType", "status");
CREATE INDEX "MarketplaceOpportunity_publishedAt_idx" ON "MarketplaceOpportunity"("publishedAt");
CREATE INDEX "MarketplaceOpportunity_expiresAt_idx" ON "MarketplaceOpportunity"("expiresAt");
CREATE INDEX "MarketplaceBid_opportunityBookingId_status_idx" ON "MarketplaceBid"("opportunityBookingId", "status");
CREATE INDEX "MarketplaceBid_partnerId_status_idx" ON "MarketplaceBid"("partnerId", "status");

ALTER TABLE "MarketplaceBid"
ADD CONSTRAINT "MarketplaceBid_opportunityBookingId_fkey"
FOREIGN KEY ("opportunityBookingId") REFERENCES "MarketplaceOpportunity"("bookingId")
ON DELETE CASCADE ON UPDATE CASCADE;
