-- CreateEnum
CREATE TYPE "CrossAlertType" AS ENUM ('PRICE_CROSS', 'FUNDING_CROSS', 'OI_CROSS');

-- CreateEnum
CREATE TYPE "AlertDeliveryMethod" AS ENUM ('DASHBOARD', 'EMAIL', 'BOTH');

-- CreateTable
CREATE TABLE "user_cross_alerts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "alertType" "CrossAlertType" NOT NULL,
    "threshold" DOUBLE PRECISION NOT NULL,
    "lastCheckedValue" DOUBLE PRECISION,
    "lastCheckedAt" TIMESTAMP(3),
    "deliveryMethod" "AlertDeliveryMethod" NOT NULL DEFAULT 'DASHBOARD',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "triggeredCount" INTEGER NOT NULL DEFAULT 0,
    "triggeredAt" TIMESTAMP(3),
    "triggeredValue" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_cross_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_cross_alerts_userId_isActive_idx" ON "user_cross_alerts"("userId", "isActive");

-- CreateIndex
CREATE INDEX "user_cross_alerts_symbol_isActive_idx" ON "user_cross_alerts"("symbol", "isActive");

-- CreateIndex
CREATE INDEX "user_cross_alerts_isActive_lastCheckedAt_idx" ON "user_cross_alerts"("isActive", "lastCheckedAt");

-- AddForeignKey
ALTER TABLE "user_cross_alerts" ADD CONSTRAINT "user_cross_alerts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
