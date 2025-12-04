-- Add timeframe field to open_interest_alerts table
-- This field tracks which timeframe threshold triggered the alert: "5 min", "15 min", "1 hour"

-- Add the column with a default value for existing records
ALTER TABLE "open_interest_alerts" ADD COLUMN IF NOT EXISTS "timeframe" TEXT NOT NULL DEFAULT '5 min';

-- Create index for efficient querying by timeframe
CREATE INDEX IF NOT EXISTS "open_interest_alerts_timeframe_ts_idx" ON "open_interest_alerts"("timeframe", "ts");
