/*
  Warnings:

  - Added the required column `updatedAt` to the `KycDocument` table without a default value. This is not possible if the table is not empty.
  - Added the required column `department` to the `Staff` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "StaffScope" AS ENUM ('HEAD_OFFICE', 'AGENCY');

-- CreateEnum
CREATE TYPE "StaffDepartment" AS ENUM ('OPERATIONS', 'CUSTOMER_CARE', 'ACCOUNTS');

-- CreateEnum
CREATE TYPE "FreightTradeMode" AS ENUM ('LOCAL', 'IMPORT', 'EXPORT', 'TRANSIT');

-- CreateEnum
CREATE TYPE "RailCorridorCode" AS ENUM ('MOMBASA_TO_ICD_NAIROBI', 'MOMBASA_TO_ICD_NAIVASHA', 'ICD_NAIROBI_TO_MOMBASA', 'ICD_NAIVASHA_TO_MOMBASA', 'OTHER');

-- CreateEnum
CREATE TYPE "TradeDocumentStatus" AS ENUM ('NOT_REQUIRED', 'PENDING', 'READY', 'SUBMITTED', 'CLEARED', 'HOLD');

-- CreateEnum
CREATE TYPE "DisbursementRail" AS ENUM ('MPESA_B2C', 'MPESA_B2B', 'BANK_TRANSFER');

-- CreateEnum
CREATE TYPE "DisbursementStatus" AS ENUM ('CREATED', 'INITIATED', 'PROCESSING', 'SUCCESS', 'FAILED', 'REVERSED');

-- CreateEnum
CREATE TYPE "SubscriptionTier" AS ENUM ('FREE', 'SILVER', 'GOLD', 'PLATINUM');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'PENDING_PAYMENT', 'SUSPENDED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "SubscriptionChargeStatus" AS ENUM ('SUCCESSFUL', 'FAILED', 'PENDING');

-- CreateEnum
CREATE TYPE "FeaturedListingStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "FeaturedListingTier" AS ENUM ('FEATURED', 'PREMIUM', 'VIP');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "BookingStatus" ADD VALUE 'QUOTE_PENDING';
ALTER TYPE "BookingStatus" ADD VALUE 'EXPIRED';

-- AlterEnum
ALTER TYPE "InvoiceType" ADD VALUE 'PLATFORM';

-- AlterEnum
ALTER TYPE "ServiceType" ADD VALUE 'RAIL';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "UserRole" ADD VALUE 'COURIER_COMPANY';
ALTER TYPE "UserRole" ADD VALUE 'HEAD_OFFICE_STAFF';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "VehicleType" ADD VALUE 'CONTAINER_20FT';
ALTER TYPE "VehicleType" ADD VALUE 'CONTAINER_40FT';

-- DropForeignKey
ALTER TABLE "Payment" DROP CONSTRAINT "Payment_bookingId_fkey";

-- DropForeignKey
ALTER TABLE "Staff" DROP CONSTRAINT "Staff_agencyId_fkey";

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "billOfLadingNumber" TEXT,
ADD COLUMN     "containerReference" TEXT,
ADD COLUMN     "customsStatus" "TradeDocumentStatus",
ADD COLUMN     "destinationNode" TEXT,
ADD COLUMN     "featuredTier" "FeaturedListingTier",
ADD COLUMN     "icmsStatus" "TradeDocumentStatus",
ADD COLUMN     "idfNumber" TEXT,
ADD COLUMN     "isFeatured" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "originNode" TEXT,
ADD COLUMN     "pacReady" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "railCorridorCode" "RailCorridorCode",
ADD COLUMN     "tradeMode" "FreightTradeMode";

-- AlterTable
ALTER TABLE "KycDocument" ADD COLUMN     "countryOfIssue" TEXT,
ADD COLUMN     "documentNumber" TEXT,
ADD COLUMN     "documentSide" TEXT,
ADD COLUMN     "issueDate" TIMESTAMP(3),
ADD COLUMN     "issuingAuthority" TEXT,
ADD COLUMN     "rejectionReason" TEXT,
ADD COLUMN     "reviewNote" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "callbackReceivedAt" TIMESTAMP(3),
ADD COLUMN     "checkoutRequestId" TEXT,
ADD COLUMN     "confirmedAt" TIMESTAMP(3),
ADD COLUMN     "invoiceId" TEXT,
ADD COLUMN     "merchantRequestId" TEXT,
ADD COLUMN     "provider" TEXT,
ADD COLUMN     "providerConversationId" TEXT,
ADD COLUMN     "providerMode" TEXT,
ADD COLUMN     "providerOriginatorConversationId" TEXT,
ADD COLUMN     "providerPayload" JSONB,
ADD COLUMN     "providerReceiptNumber" TEXT,
ADD COLUMN     "providerStatus" TEXT,
ALTER COLUMN "bookingId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "RateCard" ADD COLUMN     "countryCode" TEXT NOT NULL DEFAULT 'KE',
ADD COLUMN     "county" TEXT,
ADD COLUMN     "localityType" TEXT NOT NULL DEFAULT 'ANY';

-- AlterTable
ALTER TABLE "Staff" ADD COLUMN     "department" "StaffDepartment" NOT NULL,
ADD COLUMN     "scope" "StaffScope" NOT NULL DEFAULT 'AGENCY',
ALTER COLUMN "agencyId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "SupportTicket" ADD COLUMN     "autobotArticle" TEXT,
ADD COLUMN     "autobotConfidence" TEXT,
ADD COLUMN     "autobotEscalationDesk" TEXT,
ADD COLUMN     "autobotQuickAction" TEXT,
ADD COLUMN     "autobotSuggestedReply" TEXT,
ADD COLUMN     "autobotSummary" TEXT,
ADD COLUMN     "sourceContextId" TEXT,
ADD COLUMN     "sourceContextType" TEXT;

-- AlterTable
ALTER TABLE "Vehicle" ADD COLUMN     "chassisNumber" TEXT,
ADD COLUMN     "inspectionCertificateExpiry" TIMESTAMP(3),
ADD COLUMN     "insuranceCompany" TEXT,
ADD COLUMN     "insurancePolicyNumber" TEXT,
ADD COLUMN     "ownerUserId" TEXT,
ADD COLUMN     "rejectionReason" TEXT,
ADD COLUMN     "verificationNote" TEXT,
ADD COLUMN     "verificationReviewedAt" TIMESTAMP(3),
ADD COLUMN     "verificationReviewedBy" TEXT,
ADD COLUMN     "verificationStatus" TEXT NOT NULL DEFAULT 'PENDING_REVIEW',
ALTER COLUMN "status" SET DEFAULT 'INACTIVE';

-- CreateTable
CREATE TABLE "VehicleVerificationPhoto" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "mimeType" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING_REVIEW',
    "capturedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "reviewNote" TEXT,
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VehicleVerificationPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FreightMilestone" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "nodeLabel" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "scheduledAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "blockedReason" TEXT,
    "note" TEXT,
    "recordedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FreightMilestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingQuote" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "quotedPrice" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'KES',
    "validityStartsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validityExpiresAt" TIMESTAMP(3) NOT NULL,
    "quotedBy" TEXT NOT NULL,
    "quotedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),
    "acceptedBy" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "revisionRequestedAt" TIMESTAMP(3),
    "revisionNote" TEXT,
    "terms" TEXT,
    "paymentTerms" TEXT,
    "specialConditions" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BookingQuote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Disbursement" (
    "id" TEXT NOT NULL,
    "beneficiaryUserId" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "approvedByUserId" TEXT,
    "sourcePaymentId" TEXT,
    "sourceInvoiceId" TEXT,
    "rail" "DisbursementRail" NOT NULL,
    "status" "DisbursementStatus" NOT NULL DEFAULT 'CREATED',
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'KES',
    "reference" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "beneficiaryName" TEXT NOT NULL,
    "beneficiaryPhone" TEXT,
    "beneficiaryPartyNumber" TEXT,
    "accountReference" TEXT,
    "provider" TEXT,
    "providerMode" TEXT,
    "providerStatus" TEXT,
    "providerReceiptNumber" TEXT,
    "providerConversationId" TEXT,
    "providerOriginatorConversationId" TEXT,
    "providerPayload" JSONB,
    "failureReason" TEXT,
    "initiatedAt" TIMESTAMP(3),
    "processedAt" TIMESTAMP(3),
    "reversedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Disbursement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportTicketMessage" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "authorId" TEXT,
    "actorType" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "isInternal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportTicketMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tier" "SubscriptionTier" NOT NULL DEFAULT 'FREE',
    "monthlyPrice" INTEGER NOT NULL DEFAULT 0,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nextBillingDate" TIMESTAMP(3) NOT NULL,
    "cancelledDate" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "autoRenew" BOOLEAN NOT NULL DEFAULT true,
    "failedAttempts" INTEGER NOT NULL DEFAULT 0,
    "paymentMethod" TEXT NOT NULL DEFAULT 'MPESA',
    "cancelReason" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubscriptionCharge" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "chargedDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "SubscriptionChargeStatus" NOT NULL DEFAULT 'PENDING',
    "transactionReference" TEXT,
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubscriptionCharge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeaturedListing" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "tier" "FeaturedListingTier" NOT NULL DEFAULT 'FEATURED',
    "status" "FeaturedListingStatus" NOT NULL DEFAULT 'ACTIVE',
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiryDate" TIMESTAMP(3) NOT NULL,
    "durationDays" INTEGER NOT NULL,
    "totalCost" INTEGER NOT NULL,
    "transactionReference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeaturedListing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationFeePayment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "processingMode" TEXT NOT NULL DEFAULT 'EXPEDITED',
    "status" TEXT NOT NULL DEFAULT 'PAID',
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "refundedAt" TIMESTAMP(3),
    "expectedCompletionDate" TIMESTAMP(3),
    "transactionReference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VerificationFeePayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationCertificate" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "certificateNumber" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "issuedBy" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VerificationCertificate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VehicleVerificationPhoto_vehicleId_category_key" ON "VehicleVerificationPhoto"("vehicleId", "category");

-- CreateIndex
CREATE INDEX "FreightMilestone_bookingId_sequence_idx" ON "FreightMilestone"("bookingId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "BookingQuote_bookingId_key" ON "BookingQuote"("bookingId");

-- CreateIndex
CREATE INDEX "BookingQuote_bookingId_validityExpiresAt_idx" ON "BookingQuote"("bookingId", "validityExpiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Disbursement_reference_key" ON "Disbursement"("reference");

-- CreateIndex
CREATE INDEX "Disbursement_rail_status_idx" ON "Disbursement"("rail", "status");

-- CreateIndex
CREATE INDEX "Disbursement_beneficiaryUserId_idx" ON "Disbursement"("beneficiaryUserId");

-- CreateIndex
CREATE INDEX "Disbursement_sourcePaymentId_idx" ON "Disbursement"("sourcePaymentId");

-- CreateIndex
CREATE INDEX "Disbursement_sourceInvoiceId_idx" ON "Disbursement"("sourceInvoiceId");

-- CreateIndex
CREATE INDEX "SupportTicketMessage_ticketId_createdAt_idx" ON "SupportTicketMessage"("ticketId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_userId_key" ON "Subscription"("userId");

-- CreateIndex
CREATE INDEX "Subscription_userId_status_idx" ON "Subscription"("userId", "status");

-- CreateIndex
CREATE INDEX "Subscription_status_nextBillingDate_idx" ON "Subscription"("status", "nextBillingDate");

-- CreateIndex
CREATE INDEX "SubscriptionCharge_subscriptionId_status_idx" ON "SubscriptionCharge"("subscriptionId", "status");

-- CreateIndex
CREATE INDEX "SubscriptionCharge_chargedDate_idx" ON "SubscriptionCharge"("chargedDate");

-- CreateIndex
CREATE UNIQUE INDEX "FeaturedListing_bookingId_key" ON "FeaturedListing"("bookingId");

-- CreateIndex
CREATE INDEX "FeaturedListing_status_expiryDate_idx" ON "FeaturedListing"("status", "expiryDate");

-- CreateIndex
CREATE INDEX "FeaturedListing_tier_idx" ON "FeaturedListing"("tier");

-- CreateIndex
CREATE INDEX "VerificationFeePayment_userId_status_idx" ON "VerificationFeePayment"("userId", "status");

-- CreateIndex
CREATE INDEX "VerificationFeePayment_status_expectedCompletionDate_idx" ON "VerificationFeePayment"("status", "expectedCompletionDate");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationCertificate_certificateNumber_key" ON "VerificationCertificate"("certificateNumber");

-- CreateIndex
CREATE INDEX "VerificationCertificate_userId_status_idx" ON "VerificationCertificate"("userId", "status");

-- CreateIndex
CREATE INDEX "VerificationCertificate_expiresAt_idx" ON "VerificationCertificate"("expiresAt");

-- CreateIndex
CREATE INDEX "Payment_bookingId_idx" ON "Payment"("bookingId");

-- CreateIndex
CREATE INDEX "Payment_invoiceId_idx" ON "Payment"("invoiceId");

-- CreateIndex
CREATE INDEX "RateCard_countryCode_county_localityType_vehicleType_servic_idx" ON "RateCard"("countryCode", "county", "localityType", "vehicleType", "serviceType", "isActive");

-- CreateIndex
CREATE INDEX "Staff_userId_scope_department_idx" ON "Staff"("userId", "scope", "department");

-- CreateIndex
CREATE INDEX "Vehicle_ownerUserId_idx" ON "Vehicle"("ownerUserId");

-- AddForeignKey
ALTER TABLE "Staff" ADD CONSTRAINT "Staff_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Staff" ADD CONSTRAINT "Staff_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleVerificationPhoto" ADD CONSTRAINT "VehicleVerificationPhoto_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FreightMilestone" ADD CONSTRAINT "FreightMilestone_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingQuote" ADD CONSTRAINT "BookingQuote_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Disbursement" ADD CONSTRAINT "Disbursement_beneficiaryUserId_fkey" FOREIGN KEY ("beneficiaryUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Disbursement" ADD CONSTRAINT "Disbursement_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Disbursement" ADD CONSTRAINT "Disbursement_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Disbursement" ADD CONSTRAINT "Disbursement_sourcePaymentId_fkey" FOREIGN KEY ("sourcePaymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Disbursement" ADD CONSTRAINT "Disbursement_sourceInvoiceId_fkey" FOREIGN KEY ("sourceInvoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportTicketMessage" ADD CONSTRAINT "SupportTicketMessage_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "SupportTicket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportTicketMessage" ADD CONSTRAINT "SupportTicketMessage_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionCharge" ADD CONSTRAINT "SubscriptionCharge_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeaturedListing" ADD CONSTRAINT "FeaturedListing_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationFeePayment" ADD CONSTRAINT "VerificationFeePayment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationCertificate" ADD CONSTRAINT "VerificationCertificate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
