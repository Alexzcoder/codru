-- Per-brand price adjustment knob (PRD §8 extension).
-- Applied to prices coming from item templates, history suggestions, and
-- AI estimates. Manual unit-price entries pass through unchanged.
-- Default 0 (no adjustment); negative values run a discount (e.g. -10
-- means 10% off all generated prices).

ALTER TABLE "CompanyProfile"
ADD COLUMN "priceAdjustmentPercent" DECIMAL(5, 2) NOT NULL DEFAULT 0;
