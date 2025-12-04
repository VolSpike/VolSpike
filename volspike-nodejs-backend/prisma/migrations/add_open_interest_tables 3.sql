-- Migration: Add Open Interest tables
-- Created: 2025-12-01
-- Description: Adds three new tables for Open Interest realtime feature:
--   1. open_interest_snapshots - stores OI data from Python script or realtime poller
--   2. open_interest_alerts - stores OI spike/dump alerts
--   3. open_interest_liquid_symbols - tracks liquid universe symbols

-- Create open_interest_snapshots table
CREATE TABLE IF NOT EXISTS "open_interest_snapshots" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "ts" TIMESTAMP(3) NOT NULL,
    "openInterest" DECIMAL(30,8) NOT NULL,
    "openInterestUsd" DECIMAL(30,2),
    "markPrice" DECIMAL(20,8),
    "source" TEXT NOT NULL DEFAULT 'snapshot',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "open_interest_snapshots_pkey" PRIMARY KEY ("id")
);

-- Create indexes for open_interest_snapshots
CREATE INDEX IF NOT EXISTS "open_interest_snapshots_symbol_ts_idx" ON "open_interest_snapshots"("symbol", "ts");
CREATE INDEX IF NOT EXISTS "open_interest_snapshots_ts_idx" ON "open_interest_snapshots"("ts");
CREATE INDEX IF NOT EXISTS "open_interest_snapshots_source_ts_idx" ON "open_interest_snapshots"("source", "ts");

-- Create open_interest_alerts table
CREATE TABLE IF NOT EXISTS "open_interest_alerts" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "baseline" DECIMAL(30,8) NOT NULL,
    "current" DECIMAL(30,8) NOT NULL,
    "pctChange" DECIMAL(10,6) NOT NULL,
    "absChange" DECIMAL(30,8) NOT NULL,
    "source" TEXT NOT NULL,
    "ts" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "open_interest_alerts_pkey" PRIMARY KEY ("id")
);

-- Create indexes for open_interest_alerts
CREATE INDEX IF NOT EXISTS "open_interest_alerts_symbol_ts_idx" ON "open_interest_alerts"("symbol", "ts");
CREATE INDEX IF NOT EXISTS "open_interest_alerts_ts_idx" ON "open_interest_alerts"("ts");
CREATE INDEX IF NOT EXISTS "open_interest_alerts_direction_ts_idx" ON "open_interest_alerts"("direction", "ts");

-- Create open_interest_liquid_symbols table
CREATE TABLE IF NOT EXISTS "open_interest_liquid_symbols" (
    "symbol" TEXT NOT NULL,
    "quoteVolume24h" DECIMAL(30,2) NOT NULL,
    "enteredAt" TIMESTAMP(3) NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "open_interest_liquid_symbols_pkey" PRIMARY KEY ("symbol")
);

