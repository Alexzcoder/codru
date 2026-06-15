-- Add the "daňový doklad k přijaté platbě" document type (tax document for a
-- received advance payment). PostgreSQL 12+ allows ADD VALUE inside a migration
-- transaction as long as the new value isn't used in the same transaction.
ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'PAYMENT_TAX_DOCUMENT';
