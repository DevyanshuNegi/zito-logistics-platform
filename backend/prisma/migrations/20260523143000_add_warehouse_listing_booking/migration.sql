CREATE TABLE "WarehouseListing" (
  "id" TEXT NOT NULL,
  "warehouseId" TEXT NOT NULL,
  "partnerId" TEXT NOT NULL,
  "companyName" TEXT NOT NULL,
  "companyEmail" TEXT,
  "companyPhone" TEXT,
  "vatNumber" TEXT,
  "vatRatePct" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "vatApplies" BOOLEAN NOT NULL DEFAULT false,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "areaLabel" TEXT NOT NULL,
  "address" TEXT NOT NULL,
  "latitude" DOUBLE PRECISION,
  "longitude" DOUBLE PRECISION,
  "serviceRadiusKm" DOUBLE PRECISION,
  "storageTypes" JSONB NOT NULL,
  "amenities" JSONB NOT NULL,
  "photoUrls" JSONB NOT NULL,
  "documentUrls" JSONB NOT NULL,
  "totalCapacity" DOUBLE PRECISION NOT NULL,
  "availableCapacity" DOUBLE PRECISION NOT NULL,
  "capacityUnit" TEXT NOT NULL DEFAULT 'SQM',
  "rateAmount" DOUBLE PRECISION NOT NULL,
  "rateUnit" TEXT NOT NULL DEFAULT 'DAY',
  "handlingFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "minimumBookingDays" INTEGER NOT NULL DEFAULT 1,
  "status" TEXT NOT NULL DEFAULT 'PENDING_REVIEW',
  "reviewNote" TEXT,
  "reviewedBy" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "WarehouseListing_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WarehouseBooking" (
  "id" TEXT NOT NULL,
  "reference" TEXT NOT NULL,
  "listingId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "partnerId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'REQUESTED',
  "storageType" TEXT NOT NULL,
  "goodsDescription" TEXT NOT NULL,
  "startDate" TIMESTAMP(3) NOT NULL,
  "endDate" TIMESTAMP(3) NOT NULL,
  "capacityRequested" DOUBLE PRECISION NOT NULL,
  "capacityUnit" TEXT NOT NULL DEFAULT 'SQM',
  "baseAmount" DOUBLE PRECISION NOT NULL,
  "handlingFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "vatAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "totalAmount" DOUBLE PRECISION NOT NULL,
  "commissionRatePct" DOUBLE PRECISION NOT NULL DEFAULT 10,
  "commissionAmount" DOUBLE PRECISION NOT NULL,
  "partnerNetAmount" DOUBLE PRECISION NOT NULL,
  "customerNote" TEXT,
  "partnerNote" TEXT,
  "adminNote" TEXT,
  "acceptedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "WarehouseBooking_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WarehouseBooking_reference_key" ON "WarehouseBooking"("reference");
CREATE INDEX "WarehouseListing_partnerId_status_idx" ON "WarehouseListing"("partnerId", "status");
CREATE INDEX "WarehouseListing_areaLabel_status_idx" ON "WarehouseListing"("areaLabel", "status");
CREATE INDEX "WarehouseListing_warehouseId_idx" ON "WarehouseListing"("warehouseId");
CREATE INDEX "WarehouseBooking_customerId_status_idx" ON "WarehouseBooking"("customerId", "status");
CREATE INDEX "WarehouseBooking_partnerId_status_idx" ON "WarehouseBooking"("partnerId", "status");
CREATE INDEX "WarehouseBooking_listingId_idx" ON "WarehouseBooking"("listingId");

ALTER TABLE "WarehouseListing"
  ADD CONSTRAINT "WarehouseListing_warehouseId_fkey"
  FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "WarehouseBooking"
  ADD CONSTRAINT "WarehouseBooking_listingId_fkey"
  FOREIGN KEY ("listingId") REFERENCES "WarehouseListing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
