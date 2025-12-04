-- AlterTable
ALTER TABLE "volume_alerts" ADD COLUMN     "detectionTime" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "volume_alerts_detectionTime_idx" ON "volume_alerts"("detectionTime");
