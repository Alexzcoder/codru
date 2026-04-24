-- One-time data migration: bump rows that still carry the old default blue
-- (#1d4ed8) to the new emerald default (#059669). Rows where the user has
-- intentionally picked a different color are left untouched.
UPDATE "DocumentTemplate" SET "accentColor" = '#059669' WHERE "accentColor" = '#1d4ed8';
UPDATE "CompanyProfile"   SET "brandColor"  = '#059669' WHERE "brandColor"  = '#1d4ed8';
