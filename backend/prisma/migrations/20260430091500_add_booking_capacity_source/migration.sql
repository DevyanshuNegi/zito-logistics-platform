-- CreateEnum
CREATE TYPE "BookingCapacitySource" AS ENUM ('OWNED_FLEET', 'CFA_NETWORK', 'BLENDED');

-- AlterTable
ALTER TABLE "Booking"
ADD COLUMN "capacitySource" "BookingCapacitySource" NOT NULL DEFAULT 'CFA_NETWORK';
