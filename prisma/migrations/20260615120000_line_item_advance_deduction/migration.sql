-- Mark advance-deduction line items (negative "odečet zálohy" lines on a final
-- invoice). Excluded from the document-level discount base. Additive + defaulted
-- so existing rows are unaffected.
ALTER TABLE "DocumentLineItem"
  ADD COLUMN "isAdvanceDeduction" BOOLEAN NOT NULL DEFAULT false;
