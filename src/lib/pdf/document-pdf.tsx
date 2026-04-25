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
    options.showQrPlatba && isInvoice && qrDataUrl && !data.reverseCharge;

  const supplierLines = [
    data.company.addressStreet,
    [data.company.addressZip, data.company.addressCity].filter(Boolean).join(" "),
    data.company.addressCountry,
    data.company.ico ? `${L.ico}: ${data.company.ico}` : null,
    data.company.dic ? `${L.dic}: ${data.company.dic}` : L.notVatPayer,
  ].filter(Boolean) as string[];

  const customerLines = [
    data.client.addressStreet,
    [data.client.addressZip, data.client.addressCity].filter(Boolean).join(" "),
    data.client.addressCountry,
    data.client.ico ? `${L.ico}: ${data.client.ico}` : null,
    data.client.dic ? `${L.dic}: ${data.client.dic}` : null,
  ].filter(Boolean) as string[];

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {options.letterheadAbsolutePath && (
          <Image style={styles.letterhead} src={options.letterheadAbsolutePath} />
        )}

        {/* IDENTIFIKAČNÍ ÚDAJE: supplier left / title+customer right */}
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <Text style={styles.sectionMicro}>{L.supplier}</Text>
            <Text style={styles.partyName}>{data.company.name}</Text>
            {supplierLines.map((l, i) => (
              <Text key={i} style={styles.partyLine}>{l}</Text>
            ))}
          </View>
          <View style={styles.headerRight}>
            {options.showLogo && data.company.logoAbsolutePath && (
              <Image style={styles.logo} src={data.company.logoAbsolutePath} />
            )}
            <View style={styles.titleRow}>
              <Text style={styles.title}>{titleFor(data.type, data.locale)}</Text>
              <Text style={styles.docNumberBox}>{data.number}</Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={styles.sectionMicro}>{L.customer}</Text>
              <Text style={styles.partyName}>{data.client.displayName}</Text>
              {customerLines.map((l, i) => (
                <Text key={i} style={styles.partyLine}>{l}</Text>
              ))}
            </View>
          </View>
        </View>

        {/* Dates */}
        <View style={styles.datesRow}>
          <Text>
            <Text style={styles.dateLabel}>{L.issueDate}:</Text>
            {" "}<Text style={{ fontWeight: "bold" }}>
              {formatDate(data.issueDate, data.locale)}
            </Text>
          </Text>
          {data.taxPointDate &&
            data.taxPointDate.getTime() !== data.issueDate.getTime() &&
            data.type !== "QUOTE" && (
              <Text>
                <Text style={styles.dateLabel}>{L.taxPointDate}:</Text>
                {" "}<Text style={{ fontWeight: "bold" }}>
                  {formatDate(data.taxPointDate, data.locale)}
                </Text>
              </Text>
            )}
          {data.type === "QUOTE" && data.validUntil && (
            <Text>
              <Text style={styles.dateLabel}>{L.validUntil}:</Text>
              {" "}<Text style={{ fontWeight: "bold" }}>
                {formatDate(data.validUntil, data.locale)}
              </Text>
            </Text>
          )}
          {isInvoice && data.dueDate && (
            <Text>
              <Text style={styles.dateLabel}>{L.dueDate}:</Text>
              {" "}<Text style={{ fontWeight: "bold" }}>
                {formatDate(data.dueDate, data.locale)}
              </Text>
            </Text>
          )}
        </View>

        {/* PLATEBNÍ ÚDAJE: emerald payment band (invoices only) */}
        {isInvoice && (
          <View style={styles.paymentBand}>
            <View style={styles.paymentCol}>
              <Text style={styles.paymentLabel}>{L.bankAccount}</Text>
              {data.company.accountNumber && (
                <Text style={styles.paymentValue}>{data.company.accountNumber}</Text>
              )}
              {data.company.iban && (
                <Text style={styles.paymentValue}>IBAN: {data.company.iban}</Text>
              )}
              {data.company.swift && (
                <Text style={styles.paymentValue}>SWIFT: {data.company.swift}</Text>
              )}
            </View>
            <View style={styles.paymentCol}>
              <Text style={styles.paymentLabel}>Symbol</Text>
              {data.variableSymbol && (
                <Text style={styles.paymentValue}>
                  {data.locale === "cs" ? "variabilní" : "variable"}: {data.variableSymbol}
                </Text>
              )}
              <Text style={styles.paymentValue}>
                {data.locale === "cs" ? "konstantní" : "constant"}: 0308
              </Text>
            </View>
            <View style={styles.paymentCol}>
              <Text style={styles.paymentLabel}>
                {data.locale === "cs" ? "Způsob platby" : "Payment method"}: {data.locale === "cs" ? "Převodem" : "Bank transfer"}
              </Text>
              <Text style={styles.paymentLabel}>
                {data.locale === "cs" ? "K úhradě" : "Amount due"}
              </Text>
              <Text style={styles.paymentAmount}>
                {formatMoney(totals.totalGross, data.currency, data.locale)}
              </Text>
            </View>
            {showQr && qrDataUrl && (
              <View style={styles.qrInBand}>
                <Image style={styles.qrInBandImage} src={qrDataUrl} />
                <Text style={styles.qrInBandLabel}>QR Platba</Text>
              </View>
            )}
          </View>
        )}

        {/* Credit-note reason */}
        {data.type === "CREDIT_NOTE" && data.creditReason && (
          <View style={{ marginBottom: 8 }}>
            <Text style={styles.sectionMicro}>{L.creditReason}</Text>
            <Text>{data.creditReason}</Text>
          </View>
        )}

        {/* FAKTURUJEME VÁM: items */}
        <Text style={styles.sectionHeading}>
          {data.locale === "cs"
            ? data.type === "QUOTE"
              ? "Cenová nabídka"
              : "Fakturujeme Vám za dodané zboží či služby:"
            : "We invoice you for the following goods or services:"}
        </Text>
        <View>
          <View style={styles.itemsHeader}>
            <Text style={styles.colPos}>{L.position}</Text>
            <Text style={styles.colDesc}>{L.description}</Text>
            <Text style={styles.colQty}>{L.quantity}</Text>
            <Text style={styles.colUnit}>{L.unit}</Text>
            <Text style={styles.colPrice}>{L.unitPrice}</Text>
            <Text style={styles.colRate}>{L.taxRate}</Text>
            <Text style={styles.colNet}>{data.locale === "cs" ? "Bez DPH" : "Net"}</Text>
            <Text style={styles.colVat}>{data.locale === "cs" ? "DPH" : "VAT"}</Text>
            <Text style={styles.colTotal}>{L.lineTotal}</Text>
          </View>
          {data.lines.map((line, i) => {
            const result = totals.lines[i];
            return (
              <View key={i} style={styles.itemsRow}>
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
                <Text style={styles.colRate}>{formatPercent(line.taxRatePercent)}</Text>
                <Text style={styles.colNet}>
                  {formatMoney(result.net, data.currency, data.locale)}
                </Text>
                <Text style={styles.colVat}>
                  {formatMoney(result.tax, data.currency, data.locale)}
                </Text>
                <Text style={styles.colTotal}>
                  {formatMoney(result.gross, data.currency, data.locale)}
                </Text>
              </View>
            );
          })}
        </View>

        {/* REKAPITULACE: VAT-band breakdown + Celkem */}
        <View style={styles.recapWrap}>
          <View style={styles.recapBox}>
            <View style={styles.recapHeader}>
              <Text style={styles.recapColLabel}>
                {data.locale === "cs" ? "Sazba DPH" : "VAT rate"}
              </Text>
              <Text style={styles.recapColBase}>
                {data.locale === "cs" ? "Základ" : "Base"}
              </Text>
              <Text style={styles.recapColVat}>
                {data.locale === "cs" ? "Výše DPH" : "VAT"}
              </Text>
              <Text style={styles.recapColTotal}>
                {data.locale === "cs" ? "Celkem" : "Total"}
              </Text>
            </View>
            {!data.reverseCharge && totals.taxBands.length > 0 ? (
              totals.taxBands.map((b) => {
                const bandGross = (Number(b.net) + Number(b.tax)).toFixed(2);
                return (
                  <View key={b.ratePercent} style={styles.recapRow}>
                    <Text style={styles.recapColLabel}>{formatPercent(b.ratePercent)}</Text>
                    <Text style={styles.recapColBase}>
                      {formatMoney(b.net, data.currency, data.locale)}
                    </Text>
                    <Text style={styles.recapColVat}>
                      {formatMoney(b.tax, data.currency, data.locale)}
                    </Text>
                    <Text style={styles.recapColTotal}>
                      {formatMoney(bandGross, data.currency, data.locale)}
                    </Text>
                  </View>
                );
              })
            ) : (
              <View style={styles.recapRow}>
                <Text style={styles.recapColLabel}>—</Text>
                <Text style={styles.recapColBase}>
                  {formatMoney(totals.subtotalNet, data.currency, data.locale)}
                </Text>
                <Text style={styles.recapColVat}>—</Text>
                <Text style={styles.recapColTotal}>
                  {formatMoney(totals.totalGross, data.currency, data.locale)}
                </Text>
              </View>
            )}
            <View style={[styles.recapRow, { borderBottomWidth: 0, fontWeight: "bold" }]}>
              <Text style={styles.recapColLabel}>
                {data.locale === "cs" ? "Celkem" : "Total"}
              </Text>
              <Text style={styles.recapColBase}>
                {formatMoney(totals.subtotalNet, data.currency, data.locale)}
              </Text>
              <Text style={styles.recapColVat}>
                {formatMoney(
                  (Number(totals.totalGross) - Number(totals.subtotalNet)).toFixed(2),
                  data.currency,
                  data.locale,
                )}
              </Text>
              <Text style={styles.recapColTotal}>
                {formatMoney(totals.totalGross, data.currency, data.locale)}
              </Text>
            </View>
          </View>
        </View>

        {/* Celkem k úhradě bar */}
        <View style={styles.payTotalBar}>
          <Text style={styles.payTotalLabel}>
            {data.locale === "cs" ? "Celkem k úhradě:" : "Total due:"}
          </Text>
          <Text style={styles.payTotalValue}>
            {formatMoney(totals.totalGross, data.currency, data.locale)}
          </Text>
        </View>

        {data.reverseCharge && options.showReverseChargeNote && (
          <View style={styles.reverseChargeBox}>
            <Text>{L.reverseChargeNote}</Text>
          </View>
        )}

        {data.notesToClient && (
          <View style={{ marginTop: 14 }}>
            <Text style={styles.sectionMicro}>
              {data.locale === "cs" ? "Poznámka" : "Note"}
            </Text>
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
