import {
  Document,
  Page,
  Text,
  View,
  Image,
} from "@react-pdf/renderer";
import { registerPdfFonts, buildStyles } from "./styles";
import { labels } from "./labels";
import { calculateDocument } from "../line-items";
import { formatDate, formatMoney, formatPercent, formatQty } from "./formatting";
import type { PdfDocumentData, PdfTemplateOptions } from "./types";

registerPdfFonts();

function titleFor(type: PdfDocumentData["type"], locale: "cs" | "en"): string {
  const L = labels[locale];
  switch (type) {
    case "QUOTE":
      return L.quoteTitle;
    case "ADVANCE_INVOICE":
      return L.advanceInvoiceTitle;
    case "FINAL_INVOICE":
      return L.finalInvoiceTitle;
    case "CREDIT_NOTE":
      return L.creditNoteTitle;
  }
}

export function DocumentPdf({
  data,
  options,
  qrDataUrl,
}: {
  data: PdfDocumentData;
  options: PdfTemplateOptions;
  qrDataUrl: string | null;
}) {
  const styles = buildStyles(options.accentColor);
  const L = labels[data.locale];
  const totals = calculateDocument({
    lines: data.lines,
    documentDiscountPercent: data.documentDiscountPercent ?? undefined,
    documentDiscountAmount: data.documentDiscountAmount ?? undefined,
    reverseCharge: data.reverseCharge,
  });

  const isInvoice =
    data.type === "ADVANCE_INVOICE" || data.type === "FINAL_INVOICE";
  const showQr =
    options.showQrPlatba &&
    isInvoice &&
    qrDataUrl &&
    !data.reverseCharge;

  const metaItems: { label: string; value: string }[] = [
    { label: L.number, value: data.number },
    { label: L.issueDate, value: formatDate(data.issueDate, data.locale) },
  ];
  if (
    data.taxPointDate &&
    data.taxPointDate.getTime() !== data.issueDate.getTime() &&
    data.type !== "QUOTE"
  ) {
    metaItems.push({
      label: L.taxPointDate,
      value: formatDate(data.taxPointDate, data.locale),
    });
  }
  if (data.type === "QUOTE" && data.validUntil) {
    metaItems.push({
      label: L.validUntil,
      value: formatDate(data.validUntil, data.locale),
    });
  }
  if (isInvoice && data.dueDate) {
    metaItems.push({ label: L.dueDate, value: formatDate(data.dueDate, data.locale) });
  }
  if (isInvoice && data.variableSymbol) {
    metaItems.push({ label: L.variableSymbol, value: data.variableSymbol });
  }
  if (data.type === "CREDIT_NOTE" && data.originalDocumentNumber) {
    metaItems.push({
      label: L.originalDocument,
      value: data.originalDocumentNumber,
    });
  }

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>{titleFor(data.type, data.locale)}</Text>
            <Text style={styles.docNumber}>{data.number}</Text>
          </View>
          {options.showLogo && data.company.logoAbsolutePath && (
            <Image style={styles.logo} src={data.company.logoAbsolutePath} />
          )}
        </View>

        {/* Supplier / Customer */}
        <View style={styles.parties}>
          <PartyBlock
            label={L.supplier}
            name={data.company.name}
            lines={[
              data.company.addressStreet,
              [data.company.addressZip, data.company.addressCity].filter(Boolean).join(" "),
              data.company.addressCountry,
              data.company.ico ? `${L.ico}: ${data.company.ico}` : null,
              data.company.dic ? `${L.dic}: ${data.company.dic}` : L.notVatPayer,
            ]}
            styles={styles}
          />
          <PartyBlock
            label={L.customer}
            name={data.client.displayName}
            lines={[
              data.client.addressStreet,
              [data.client.addressZip, data.client.addressCity].filter(Boolean).join(" "),
              data.client.addressCountry,
              data.client.ico ? `${L.ico}: ${data.client.ico}` : null,
              data.client.dic ? `${L.dic}: ${data.client.dic}` : null,
            ]}
            styles={styles}
          />
        </View>

        {/* Meta grid */}
        <View style={styles.metaGrid}>
          {metaItems.map((m) => (
            <View key={m.label} style={styles.metaItem}>
              <Text style={styles.metaLabel}>{m.label}</Text>
              <Text style={styles.metaValue}>{m.value}</Text>
            </View>
          ))}
        </View>

        {/* Credit note reason */}
        {data.type === "CREDIT_NOTE" && data.creditReason && (
          <View style={{ marginBottom: 10 }}>
            <Text style={styles.metaLabel}>{L.creditReason}</Text>
            <Text>{data.creditReason}</Text>
          </View>
        )}

        {/* Line items table */}
        <View>
          <View style={styles.itemsHeader}>
            <Text style={styles.colPos}>{L.position}</Text>
            <Text style={styles.colDesc}>{L.description}</Text>
            <Text style={styles.colQty}>{L.quantity}</Text>
            <Text style={styles.colUnit}>{L.unit}</Text>
            <Text style={styles.colPrice}>{L.unitPrice}</Text>
            <Text style={styles.colRate}>{L.taxRate}</Text>
            <Text style={styles.colTotal}>{L.lineTotal}</Text>
          </View>
          {data.lines.map((line, i) => {
            const result = totals.lines[i];
            return (
              <View
                key={i}
                style={[styles.itemsRow, i % 2 === 1 ? styles.itemsRowAlt : {}]}
              >
                <Text style={styles.colPos}>{line.position}</Text>
                <View style={styles.colDesc}>
                  <Text style={{ fontWeight: "bold" }}>{line.name}</Text>
                  {line.description && (
                    <Text style={{ color: "#555" }}>{line.description}</Text>
                  )}
                </View>
                <Text style={styles.colQty}>{formatQty(line.quantity)}</Text>
                <Text style={styles.colUnit}>{line.unit}</Text>
                <Text style={styles.colPrice}>
                  {formatMoney(line.unitPrice, data.currency, data.locale)}
                </Text>
                <Text style={styles.colRate}>
                  {formatPercent(line.taxRatePercent)}
                </Text>
                <Text style={styles.colTotal}>
                  {formatMoney(result.gross, data.currency, data.locale)}
                </Text>
              </View>
            );
          })}
        </View>

        {/* Totals */}
        <View style={styles.totalsWrap}>
          <View style={styles.totalsBox}>
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>{L.subtotal}</Text>
              <Text style={styles.totalsValue}>
                {formatMoney(totals.subtotalNet, data.currency, data.locale)}
              </Text>
            </View>
            {totals.documentDiscount !== "0.00" && (
              <View style={styles.totalsRow}>
                <Text style={styles.totalsLabel}>{L.documentDiscount}</Text>
                <Text style={styles.totalsValue}>
                  −{formatMoney(totals.documentDiscount, data.currency, data.locale)}
                </Text>
              </View>
            )}
            {/* Per-band breakdown (only interesting when multi-rate or non-reverse) */}
            {!data.reverseCharge &&
              totals.taxBands.length > 0 &&
              totals.taxBands.map((b) => (
                <View key={b.ratePercent} style={styles.totalsRow}>
                  <Text style={styles.totalsLabel}>
                    {L.taxBase} {formatPercent(b.ratePercent)} /{" "}
                    {formatMoney(b.net, data.currency, data.locale)}
                  </Text>
                  <Text style={styles.totalsValue}>
                    {formatMoney(b.tax, data.currency, data.locale)}
                  </Text>
                </View>
              ))}
            <View style={styles.grossRow}>
              <Text style={styles.grossLabel}>{L.totalGross}</Text>
              <Text style={styles.grossValue}>
                {formatMoney(totals.totalGross, data.currency, data.locale)}
              </Text>
            </View>
          </View>
        </View>

        {/* Reverse charge note */}
        {data.reverseCharge && options.showReverseChargeNote && (
          <View style={styles.reverseChargeBox}>
            <Text>{L.reverseChargeNote}</Text>
          </View>
        )}

        {/* Bank details (invoices only) */}
        {isInvoice && (data.company.iban || data.company.accountNumber) && (
          <View style={{ marginTop: 16 }}>
            <Text style={styles.metaLabel}>{L.bankAccount}</Text>
            {data.company.iban && (
              <Text>
                {L.iban}: {data.company.iban}
                {data.company.swift ? ` · ${L.swift}: ${data.company.swift}` : ""}
              </Text>
            )}
            {data.company.accountNumber && (
              <Text>{data.company.accountNumber}</Text>
            )}
          </View>
        )}

        {/* Notes to client */}
        {data.notesToClient && (
          <View style={{ marginTop: 14 }}>
            <Text style={styles.metaLabel}>Poznámka</Text>
            <Text>{data.notesToClient}</Text>
          </View>
        )}

        {/* Signature */}
        {options.showSignature && (
          <View style={styles.signatureBox}>
            {data.signatureAbsolutePath && (
              <Image
                style={styles.signatureImage}
                src={data.signatureAbsolutePath}
              />
            )}
            <Text style={styles.signatureLine}>
              {data.issuedByName
                ? `${L.issuedBy}: ${data.issuedByName}`
                : L.signature}
              {" · "}
              {formatDate(data.issueDate, data.locale)}
            </Text>
          </View>
        )}

        {/* QR platba (floats bottom-right of first page only) */}
        {showQr && qrDataUrl && (
          <View style={styles.qrWrap} fixed>
            <Image style={styles.qrImage} src={qrDataUrl} />
            <Text style={styles.qrLabel}>{L.qrLabel}</Text>
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text>
            {options.customFooterText ??
              data.company.defaultFooterText ??
              L.thanksForBusiness}
          </Text>
          <Text
            render={({ pageNumber, totalPages }) =>
              `${L.page} ${pageNumber} ${L.of} ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  );
}

function PartyBlock({
  label,
  name,
  lines,
  styles,
}: {
  label: string;
  name: string;
  lines: (string | null | undefined)[];
  styles: ReturnType<typeof buildStyles>;
}) {
  return (
    <View style={styles.partyCol}>
      <Text style={styles.partyLabel}>{label}</Text>
      <Text style={styles.partyName}>{name}</Text>
      {lines.filter(Boolean).map((l, i) => (
        <Text key={i} style={styles.partyLine}>
          {l}
        </Text>
      ))}
    </View>
  );
}
