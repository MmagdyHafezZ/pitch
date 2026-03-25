-- AlterTable
ALTER TABLE "public"."Session" ADD COLUMN     "coinPeriodKey" TEXT,
ADD COLUMN     "coinPriceUsd" DOUBLE PRECISION,
ADD COLUMN     "coinReservationId" TEXT,
ADD COLUMN     "estimatedCoins" INTEGER;
