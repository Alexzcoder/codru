import type { DocumentType } from "@prisma/client";
import type { PdfLocale } from "./labels";
import type { LineInput } from "../line-items";

export type PdfCompany = {
  name: string;
  ico: string | null;
  dic: string | null;
  addressStreet: string | null;
  addressCity: string | null;
  addressZip: string | null;
  addressCountry: string | null;
  iban: string | null;
  swift: string | null;
  accountNumber: string | null;
  logoAbsolutePath: string | null; // absolute filesystem path or URL
  defaultFooterText?: string | null;
};

export type PdfClient = {
  type: "INDIVIDUAL" | "COMPANY";
  displayName: string;
  ico: string | null;
  dic: string | null;
  addressStreet: string | null;
  addressCity: string | null;
  addressZip: string | null;
  addressCountry: string | null;
};

export type PdfLineItem = LineInput & {
  position: number;
  name: string;
  description?: string | null;
  unit: string;
};

export type PdfDocumentData = {
  type: DocumentType;
  locale: PdfLocale;
  currency: string;
  number: string;
  issueDate: Date;
  taxPointDate?: Date | null;
  dueDate?: Date | null;
  validUntil?: Date | null;
  variableSymbol?: string | null;

  company: PdfCompany;
  client: PdfClient;

  lines: PdfLineItem[];
  documentDiscountPercent?: string | null;
  documentDiscountAmount?: string | null;
  reverseCharge: boolean;

  // Credit notes only
  originalDocumentNumber?: string | null;
  creditReason?: string | null;

  notesToClient?: string | null;
  signatureAbsolutePath?: string | null;
  issuedByName?: string | null;
};

export type PdfTemplateOptions = {
  accentColor: string;
  showLogo: boolean;
  showSignature: boolean;
  showQrPlatba: boolean;
  showReverseChargeNote: boolean;
  customHeaderText?: string | null;
  customFooterText?: string | null;
};
