ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'AGENT';

ALTER TABLE "Driver"
ADD COLUMN "ownerUserId" TEXT;

ALTER TABLE "Driver"
ADD CONSTRAINT "Driver_ownerUserId_fkey"
FOREIGN KEY ("ownerUserId") REFERENCES "User"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

CREATE INDEX "Driver_ownerUserId_idx" ON "Driver"("ownerUserId");
