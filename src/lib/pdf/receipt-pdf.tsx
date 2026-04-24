import { Document, Page, Text, View } from "@react-pdf/renderer";
import { registerPdfFonts, buildStyles } from "./styles";
import { formatDate, formatMoney } from "./formatting";
import type { PdfLocale } from "./labels";

registerPdfFonts();

export type ReceiptData = {
  locale: PdfLocale;
  paymentDate: Date;
  method: "BANK_TRANSFER" | "CASH" | "OTHER";
  amount: string;
  currency: string;
  reference: string | null;
  notes: string | null;
  company: {
    name: string;
    ico: string | null;
    dic: string | null;
    addressStreet: string | null;
    addressCity: string | null;
    addressZip: string | null;
  };
  client: {
    displayName: string;
    ico: string | null;
    addressStreet: string | null;
    addressCity: string | null;
    addressZip: string | null;
  };
  allocations: {
    invoiceNumber: string | null;
    amount: string;
  }[];
  issuedByName: string;
};

const TITLES: Record<PdfLocale, string> = {
  cs: "Doklad o přijetí platby",
  en: "Payment receipt",
};
const LABELS = {
  cs: {
    date: "Datum přijetí",
    method: "Způsob platby",
    amount: "Přijatá částka",
    reference: "Reference",
    supplier: "Dodavatel",
    payer: "Plátce",
    allocatedTo: "Přiřazeno k fakturám",
    invoice: "Faktura",
    allocation: "Částka",
    bankTransfer: "Bankovní převod",
    cash: "Hotovost",
    other: "Jiný",
    notes: "Poznámky",
    issuedBy: "Vystavil",
  },
  en: {
    date: "Date received",
    method: "Method",
    amount: "Amount received",
    reference: "Reference",
    supplier: "Supplier",
    payer: "Payer",
    allocatedTo: "Allocated to invoices",
    invoice: "Invoice",
    allocation: "Amount",
    bankTransfer: "Bank transfer",
    cash: "Cash",
    other: "Other",
    notes: "Notes",
    issuedBy: "Issued by",
  },
} as const;

function methodLabel(m: ReceiptData["method"], locale: PdfLocale): string {
  const L = LABELS[locale];
  if (m === "BANK_TRANSFER") return L.bankTransfer;
  if (m === "CASH") return L.cash;
  return L.other;
}

export function ReceiptPdf({ data, accent = "#059669" }: { data: ReceiptData; accent?: string }) {
  const styles = buildStyles(accent);
  const L = LABELS[data.locale];

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>{TITLES[data.locale]}</Text>
            <Text style={styles.docNumber}>
              {formatDate(data.paymentDate, data.locale)}
            </Text>
          </View>
        </View>

        <View style={styles.parties}>
          <View style={styles.partyCol}>
            <Text style={styles.partyLabel}>{L.supplier}</Text>
            <Text style={styles.partyName}>{data.company.name}</Text>
            {data.company.addressStreet && <Text style={styles.partyLine}>{data.company.addressStreet}</Text>}
            {(data.company.addressZip || data.company.addressCity) && (
              <Text style={styles.partyLine}>
                {[data.company.addressZip, data.company.addressCity].filter(Boolean).join(" ")}
              </Text>
            )}
            {data.company.ico && <Text style={styles.partyLine}>IČO {data.company.ico}</Text>}
            {data.company.dic && <Text style={styles.partyLine}>DIČ {data.company.dic}</Text>}
          </View>
          <View style={styles.partyCol}>
            <Text style={styles.partyLabel}>{L.payer}</Text>
            <Text style={styles.partyName}>{data.client.displayName}</Text>
            {data.client.addressStreet && <Text style={styles.partyLine}>{data.client.addressStreet}</Text>}
            {(data.client.addressZip || data.client.addressCity) && (
              <Text style={styles.partyLine}>
                {[data.client.addressZip, data.client.addressCity].filter(Boolean).join(" ")}
              </Text>
            )}
            {data.client.ico && <Text style={styles.partyLine}>IČO {data.client.ico}</Text>}
          </View>
        </View>

        <View style={styles.metaGrid}>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>{L.date}</Text>
            <Text style={styles.metaValue}>{formatDate(data.paymentDate, data.locale)}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>{L.method}</Text>
            <Text style={styles.metaValue}>{methodLabel(data.method, data.locale)}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>{L.amount}</Text>
            <Text style={styles.metaValue}>
              {formatMoney(data.amount, data.currency, data.locale)}
            </Text>
          </View>
          {data.reference && (
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>{L.reference}</Text>
              <Text style={styles.metaValue}>{data.reference}</Text>
            </View>
          )}
        </View>

        {data.allocations.length > 0 && (
          <View style={{ marginTop: 10 }}>
            <Text style={{ fontSize: 10, fontWeight: "bold", marginBottom: 4 }}>
              {L.allocatedTo}
            </Text>
            <View style={styles.itemsHeader}>
              <Text style={{ flex: 1 }}>{L.invoice}</Text>
              <Text style={{ width: 120, textAlign: "right" }}>{L.allocation}</Text>
            </View>
            {data.allocations.map((a, i) => (
              <View
                key={i}
                style={[styles.itemsRow, i % 2 === 1 ? styles.itemsRowAlt : {}]}
              >
                <Text style={{ flex: 1 }}>{a.invoiceNumber ?? "(draft)"}</Text>
                <Text style={{ width: 120, textAlign: "right" }}>
                  {formatMoney(a.amount, data.currency, data.locale)}
                </Text>
              </View>
            ))}
          </View>
        )}

        {data.notes && (
          <View style={{ marginTop: 14 }}>
            <Text style={styles.metaLabel}>{L.notes}</Text>
            <Text>{data.notes}</Text>
          </View>
        )}

        <View style={styles.signatureBox}>
          <Text style={styles.signatureLine}>
            {L.issuedBy}: {data.issuedByName} · {formatDate(data.paymentDate, data.locale)}
          </Text>
        </View>
      </Page>
    </Document>
  );
}
