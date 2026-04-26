// JSON payload shapes stored on RecurrenceRule.payload, keyed by target kind.
// Keep these stable — migrations don't auto-update the JSON.

export type JobPayload = {
  kind: "JOB";
  title: string;
  clientId: string;
  notes: string | null;
  durationDays: number; // scheduledEnd = scheduledStart + durationDays
  startHour: number; // 0–23 local; scheduledStart time
  durationHours: number;
  assigneeUserIds: string[];
  siteStreet: string | null;
  siteCity: string | null;
  siteZip: string | null;
  siteCountry: string | null;

  // Optional: emit an invoice on each cycle, linked to the freshly-created job.
  // When autoInvoice=true, the runner mints a UNSENT FINAL_INVOICE alongside
  // the job — owner can edit lines / send / mark paid as usual.
  autoInvoice?: boolean;
  invoiceCompanyProfileId?: string | null;
  invoiceDocumentTemplateId?: string | null;
  invoiceCurrency?: string;
  invoiceLocale?: "cs" | "en";
  invoiceDueInDays?: number;
  invoiceReverseCharge?: boolean;
  invoiceLines?: InvoiceLinePayload[];
};

export type ExpensePayload = {
  kind: "EXPENSE";
  categoryId: string;
  supplier: string | null;
  description: string;
  netAmount: string;
  vatRatePercent: string;
  vatAmount: string;
  currency: string;
  reverseCharge: boolean;
  paymentMethod: "BANK" | "CASH";
  jobId: string | null;
  taxDeductible: boolean;
  notes: string | null;
};

export type InvoiceLinePayload = {
  name: string;
  description: string | null;
  quantity: string;
  unit: string;
  unitPrice: string;
  taxRatePercent: string;
  taxMode: "NET" | "GROSS";
  lineDiscountPercent: string | null;
  lineDiscountAmount: string | null;
};

export type InvoicePayload = {
  kind: "INVOICE";
  clientId: string;
  jobId: string | null;
  companyProfileId: string;
  documentTemplateId: string;
  currency: string;
  locale: "cs" | "en";
  reverseCharge: boolean;
  documentDiscountPercent: string | null;
  documentDiscountAmount: string | null;
  notesInternal: string | null;
  notesToClient: string | null;
  dueInDays: number;
  lines: InvoiceLinePayload[];
};

export type AnyPayload = JobPayload | ExpensePayload | InvoicePayload;
