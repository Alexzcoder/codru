-- AlterTable
ALTER TABLE "CompanyProfile" ALTER COLUMN "brandColor" SET DEFAULT '#059669';

-- AlterTable
ALTER TABLE "DocumentTemplate" ADD COLUMN     "letterheadImagePath" TEXT,
ALTER COLUMN "accentColor" SET DEFAULT '#059669';
