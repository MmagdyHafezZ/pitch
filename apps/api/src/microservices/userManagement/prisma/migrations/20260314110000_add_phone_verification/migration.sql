CREATE TYPE "public"."PhoneVerificationStatus" AS ENUM ('pending', 'verified', 'expired', 'cancelled');

ALTER TABLE "public"."users"
ADD COLUMN "phoneNumber" TEXT,
ADD COLUMN "phoneVerifiedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "users_phoneNumber_key" ON "public"."users"("phoneNumber");

CREATE TABLE "public"."phone_verification_challenges" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "status" "public"."PhoneVerificationStatus" NOT NULL DEFAULT 'pending',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastSentAt" TIMESTAMP(3) NOT NULL,
    "sendCount" INTEGER NOT NULL DEFAULT 1,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "phone_verification_challenges_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "phone_verification_challenges_userId_status_createdAt_idx"
ON "public"."phone_verification_challenges"("userId", "status", "createdAt");

CREATE INDEX "phone_verification_challenges_phoneNumber_status_createdAt_idx"
ON "public"."phone_verification_challenges"("phoneNumber", "status", "createdAt");

ALTER TABLE "public"."phone_verification_challenges"
ADD CONSTRAINT "phone_verification_challenges_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "public"."users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
