// PDF labels — Czech + English. Kept separate from UI strings because PDFs
// are rendered regardless of the current UI locale.

export type PdfLocale = "cs" | "en";

export const labels = {
  cs: {
    quoteTitle: "Cenová nabídka",
    advanceInvoiceTitle: "Zálohová faktura",
    finalInvoiceTitle: "Faktura",
    creditNoteTitle: "Opravný daňový doklad",

    number: "Číslo dokladu",
    issueDate: "Datum vystavení",
    taxPointDate: "Datum uskut. zd. plnění",
    dueDate: "Datum splatnosti",
    validUntil: "Platnost do",

    supplier: "Dodavatel",
    customer: "Odběratel",
    ico: "IČO",
    dic: "DIČ",
    notVatPayer: "Neplátce DPH",

    bankAccount: "Bankovní účet",
    iban: "IBAN",
    swift: "SWIFT",
    variableSymbol: "Variabilní symbol",
    paymentMethod: "Způsob platby",
    bankTransfer: "Bankovní převod",

    // Line items table
    position: "Pol.",
    description: "Popis",
    quantity: "Množství",
    unit: "MJ",
    unitPrice: "Cena/MJ",
    taxRate: "DPH",
    lineTotal: "Celkem",

    subtotal: "Mezisoučet",
    documentDiscount: "Sleva",
    taxBreakdown: "Rekapitulace DPH",
    taxBase: "Základ",
    taxAmount: "DPH",
    totalNet: "Základ celkem",
    totalTax: "DPH celkem",
    totalGross: "Celkem k úhradě",

    reverseChargeNote:
      "Daň odvede zákazník podle § 92e zákona č. 235/2004 Sb. o DPH.",
    qrLabel: "QR platba",

    originalDocument: "Původní doklad",
    creditReason: "Důvod opravy",

    page: "Strana",
    of: "z",
    signature: "Podpis",
    issuedBy: "Vystavil",
    thanksForBusiness: "Děkujeme za spolupráci.",
  },
  en: {
    quoteTitle: "Quote",
    advanceInvoiceTitle: "Advance invoice",
    finalInvoiceTitle: "Invoice",
    creditNoteTitle: "Credit note",

    number: "Document no.",
    issueDate: "Issue date",
    taxPointDate: "Tax point date",
    dueDate: "Due date",
    validUntil: "Valid until",

    supplier: "Supplier",
    customer: "Customer",
    ico: "Company ID",
    dic: "VAT ID",
    notVatPayer: "Not a VAT payer",

    bankAccount: "Bank account",
    iban: "IBAN",
    swift: "SWIFT",
    variableSymbol: "Variable symbol",
    paymentMethod: "Payment method",
    bankTransfer: "Bank transfer",

    position: "#",
    description: "Description",
    quantity: "Qty",
    unit: "Unit",
    unitPrice: "Unit price",
    taxRate: "VAT",
    lineTotal: "Total",

    subtotal: "Subtotal",
    documentDiscount: "Discount",
    taxBreakdown: "VAT breakdown",
    taxBase: "Net",
    taxAmount: "VAT",
    totalNet: "Net total",
    totalTax: "VAT total",
    totalGross: "Amount due",

    reverseChargeNote:
      "VAT to be accounted for by the customer under §92e of Act 235/2004.",
    qrLabel: "QR payment",

    originalDocument: "Original document",
    creditReason: "Reason for correction",

    page: "Page",
    of: "of",
    signature: "Signature",
    issuedBy: "Issued by",
    thanksForBusiness: "Thank you for your business.",
  },
} as const;

export type LabelKey = keyof typeof labels.cs;
