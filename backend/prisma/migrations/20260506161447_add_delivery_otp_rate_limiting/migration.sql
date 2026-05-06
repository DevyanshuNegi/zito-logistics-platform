-- Add delivery OTP rate limiting fields to Booking table
ALTER TABLE "Booking" ADD COLUMN "deliveryOtpAttempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Booking" ADD COLUMN "deliveryOtpLockedUntil" TIMESTAMP(3);
