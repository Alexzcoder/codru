import type { DocumentType } from "@prisma/client";
import type { PdfDocumentData, PdfLineItem } from "./types";
import path from "node:path";

// Produces realistic sample data so document templates can be previewed
// before any real Quote/Invoice record exists (M7). Once M8+ adds real
// records, the same shape is populated from the DB.

const DEMO_LINES: PdfLineItem[] = [
  {
    position: 1,
    name: "Montážní práce",
    description: "Demontáž staré kuchyňské linky",
    quantity: "6",
    unit: "hod",
    unitPrice: "650",
    taxRatePercent: "21",
    taxMode: "NET",
  },
  {
    position: 2,
    name: "Nová kuchyňská linka",
    description: "Vč. dopravy a vyrovnání",
    quantity: "1",
    unit: "ks",
    unitPrice: "38500",
    taxRatePercent: "21",
    taxMode: "NET",
  },
  {
    position: 3,
    name: "Instalace dřezu a baterie",
    quantity: "1",
    unit: "ks",
    unitPrice: "2400",
    taxRatePercent: "21",
    taxMode: "NET",
  },
  {
    position: 4,
    name: "Likvidace odpadu",
    quantity: "1",
    unit: "ks",
    unitPrice: "800",
    taxRatePercent: "12",
    taxMode: "NET",
  },
];

export function buildSampleData(
  type: DocumentType,
  opts: {
    locale: "cs" | "en";
    company: {
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
      logoPath: string | null;
      defaultFooterText: string | null;
    } | null;
    signaturePath: string | null;
    issuedByName: string | null;
  },
): PdfDocumentData {
  const today = new Date();
  const due = new Date(today);
  due.setDate(due.getDate() + 14);
  const validUntil = new Date(today);
  validUntil.setDate(validUntil.getDate() + 30);

  const number = {
    QUOTE: `Q-${today.getFullYear()}-0001`,
    ADVANCE_INVOICE: `ADV-${today.getFullYear()}-0001`,
    FINAL_INVOICE: `INV-${today.getFullYear()}-0001`,
    CREDIT_NOTE: `CN-${today.getFullYear()}-0001`,
  }[type];

  const absolute = (p: string | null) =>
    p && p.startsWith("/uploads/")
      ? path.join(process.cwd(), "public", p)
      : null;

  return {
    type,
    locale: opts.locale,
    currency: "CZK",
    number,
    issueDate: today,
    taxPointDate: today,
    dueDate: type === "QUOTE" ? null : due,
    validUntil: type === "QUOTE" ? validUntil : null,
    variableSymbol: number.replace(/\D/g, ""),
    company: {
      name: opts.company?.name ?? "Vaše firma s.r.o.",
      ico: opts.company?.ico ?? "12345678",
      dic: opts.company?.dic ?? "CZ12345678",
      addressStreet: opts.company?.addressStreet ?? "Národní 28",
      addressCity: opts.company?.addressCity ?? "Praha 1",
      addressZip: opts.company?.addressZip ?? "110 00",
      addressCountry: opts.company?.addressCountry ?? "Česká republika",
      iban: opts.company?.iban ?? "CZ65 0800 0000 1920 0014 5399",
      swift: opts.company?.swift ?? "GIBACZPX",
      accountNumber: opts.company?.accountNumber ?? null,
      logoAbsolutePath: absolute(opts.company?.logoPath ?? null),
      defaultFooterText: opts.company?.defaultFooterText ?? null,
    },
    client: {
      type: "COMPANY",
      displayName: "Novák & syn stavby s.r.o.",
      ico: "27074358",
      dic: "CZ27074358",
      addressStreet: "Vinohradská 112",
      addressCity: "Praha 3",
      addressZip: "130 00",
      addressCountry: "Česká republika",
    },
    lines:
      type === "CREDIT_NOTE"
        ? // Credit note shows a negative correction line.
          [
            {
              position: 1,
              name: "Sleva — reklamace kvality montáže",
              description: "Oprava fakturace za původní doklad",
              quantity: "1",
              unit: "ks",
              unitPrice: "-5000",
              taxRatePercent: "21",
              taxMode: "NET",
            },
          ]
        : DEMO_LINES,
    documentDiscountPercent: type === "QUOTE" ? "5" : null,
    documentDiscountAmount: null,
    reverseCharge: false,
    originalDocumentNumber:
      type === "CREDIT_NOTE" ? `INV-${today.getFullYear()}-0001` : null,
    creditReason:
      type === "CREDIT_NOTE"
        ? "Reklamace kvality montáže — dohodnutá sleva 5 000 Kč."
        : null,
    notesToClient:
      type === "QUOTE"
        ? "Cenová nabídka je platná 30 dní. Cena zahrnuje dopravu v rámci Prahy."
        : null,
    signatureAbsolutePath: absolute(opts.signaturePath),
    issuedByName: opts.issuedByName,
  };
}
