-- Add CANCELLED to DocumentStatus. Voids a sent document without issuing a
-- credit note (drafts are deleted, not cancelled).
ALTER TYPE "DocumentStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';
