-- Migration: Add distance_km to schools table
-- Purpose: Track distance for delivery target time

ALTER TABLE schools
  ADD COLUMN IF NOT EXISTS distance_km DECIMAL(5,2) DEFAULT 0;
