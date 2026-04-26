-- Drop the deprecated default cost column on ItemTemplate. Markup % and
-- defaultUnitPrice remain; cost was unused in any pricing path.
ALTER TABLE "ItemTemplate" DROP COLUMN IF EXISTS "defaultCost";
