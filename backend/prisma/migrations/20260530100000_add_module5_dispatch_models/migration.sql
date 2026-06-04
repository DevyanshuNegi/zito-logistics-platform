-- Module 5: Add Driver Assignment tracking (PRD §16 - Dispatch)
-- Tracks the lifecycle of driver assignment: OFFERED → ACCEPTED/REJECTED → REASSIGNED/COMPLETED

-- Create enum types
CREATE TYPE "DriverAssignmentStatus" AS ENUM ('OFFERED', 'ACCEPTED', 'REJECTED', 'REASSIGNED', 'COMPLETED', 'EXPIRED');

CREATE TYPE "VehiclePhotoType" AS ENUM ('PLATE', 'FRONT', 'RIGHT', 'LEFT', 'REAR', 'CHASSIS', 'INSURANCE');

CREATE TYPE "PhotoVerificationStatus" AS ENUM ('PENDING_REVIEW', 'APPROVED', 'REJECTED', 'RESUBMISSION_REQUIRED');

-- Add dispatch tracking fields to Booking table
ALTER TABLE "Booking" ADD COLUMN "assignedAt" TIMESTAMP(3);
ALTER TABLE "Booking" ADD COLUMN "acceptedAt" TIMESTAMP(3);
ALTER TABLE "Booking" ADD COLUMN "dispatchLogId" TEXT;
ALTER TABLE "Booking" ADD COLUMN "manuallyAssignedBy" TEXT;
ALTER TABLE "Booking" ADD COLUMN "manuallyAssignedAt" TIMESTAMP(3);

-- Create DriverAssignment table
CREATE TABLE "DriverAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bookingId" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "vehicleId" TEXT,
    "status" "DriverAssignmentStatus" NOT NULL DEFAULT 'OFFERED',
    "offeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "reassignedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "matchScore" DOUBLE PRECISION,
    "priorityScore" DOUBLE PRECISION,
    "distanceKm" DOUBLE PRECISION,
    "estimatedArrivalMinutes" INTEGER,
    "manuallyOfferedBy" TEXT,
    "manuallyOfferedAt" TIMESTAMP(3),
    "radiusKmAtOffer" INTEGER DEFAULT 10,
    "attemptNumber" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DriverAssignment_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "DriverAssignment_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "DriverAssignment_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- Create indexes for DriverAssignment
CREATE INDEX "DriverAssignment_bookingId_status_idx" ON "DriverAssignment"("bookingId", "status");
CREATE INDEX "DriverAssignment_driverId_status_idx" ON "DriverAssignment"("driverId", "status");
CREATE INDEX "DriverAssignment_offeredAt_idx" ON "DriverAssignment"("offeredAt");

-- Create VehicleVerificationPhoto table (replacing old one with improved structure)
DROP TABLE IF EXISTS "VehicleVerificationPhoto";

CREATE TABLE "VehicleVerificationPhoto" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "vehicleId" TEXT NOT NULL,
    "photoType" "VehiclePhotoType" NOT NULL,
    "photoUrl" TEXT NOT NULL,
    "status" "PhotoVerificationStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNotes" TEXT,
    "timestamp" TIMESTAMP(3),
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "VehicleVerificationPhoto_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- Create indexes for VehicleVerificationPhoto
CREATE INDEX "VehicleVerificationPhoto_vehicleId_photoType_idx" ON "VehicleVerificationPhoto"("vehicleId", "photoType");
CREATE INDEX "VehicleVerificationPhoto_status_idx" ON "VehicleVerificationPhoto"("status");
