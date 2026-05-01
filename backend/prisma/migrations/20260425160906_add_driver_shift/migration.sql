/*
  Warnings:

  - You are about to drop the column `deliveryAddress` on the `Booking` table. All the data in the column will be lost.
  - You are about to drop the column `pickupAddress` on the `Booking` table. All the data in the column will be lost.
  - You are about to drop the column `price` on the `Booking` table. All the data in the column will be lost.
  - You are about to drop the column `totalWeight` on the `Booking` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[reference]` on the table `Booking` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `estimatedDist` to the `Booking` table without a default value. This is not possible if the table is not empty.
  - Added the required column `reference` to the `Booking` table without a default value. This is not possible if the table is not empty.
  - Added the required column `totalPrice` to the `Booking` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Booking" DROP COLUMN "deliveryAddress",
DROP COLUMN "pickupAddress",
DROP COLUMN "price",
DROP COLUMN "totalWeight",
ADD COLUMN     "baseFare" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "distanceFare" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "estimatedDist" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "reference" TEXT NOT NULL,
ADD COLUMN     "stopFare" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "surgeMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
ADD COLUMN     "totalPrice" DOUBLE PRECISION NOT NULL;

-- CreateTable
CREATE TABLE "BookingStop" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "address" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "contactName" TEXT NOT NULL,
    "contactPhone" TEXT NOT NULL,
    "stopType" TEXT NOT NULL,
    "arrivalTime" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "otp" TEXT,

    CONSTRAINT "BookingStop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateCard" (
    "id" TEXT NOT NULL,
    "vehicleType" TEXT NOT NULL,
    "baseFare" DOUBLE PRECISION NOT NULL,
    "ratePerKm" DOUBLE PRECISION NOT NULL,
    "perStopRate" DOUBLE PRECISION NOT NULL,
    "minDistance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InternalAlert" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'medium',
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "agencyId" TEXT,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InternalAlert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Booking_reference_key" ON "Booking"("reference");

-- AddForeignKey
ALTER TABLE "BookingStop" ADD CONSTRAINT "BookingStop_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
