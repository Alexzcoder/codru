import { Font, StyleSheet } from "@react-pdf/renderer";
import path from "node:path";

let fontsRegistered = false;
export function registerPdfFonts() {
  if (fontsRegistered) return;
  const base = path.join(process.cwd(), "public", "fonts");
  Font.register({
    family: "Roboto",
    fonts: [
      { src: path.join(base, "Roboto-Regular.ttf"), fontWeight: "normal" },
      { src: path.join(base, "Roboto-Bold.ttf"), fontWeight: "bold" },
    ],
  });
  Font.registerHyphenationCallback((word) => [word]);
  fontsRegistered = true;
}

export function buildStyles(accent: string) {
  return StyleSheet.create({
    page: {
      paddingTop: 36,
      paddingBottom: 60,
      paddingHorizontal: 36,
      fontFamily: "Roboto",
      fontSize: 9,
      color: "#111",
      lineHeight: 1.35,
    },

    // Letterhead (optional banner)
    letterhead: {
      width: "100%",
      maxHeight: 90,
      objectFit: "contain",
      marginBottom: 12,
    },

    // Header: supplier (left) / title-box + customer (right)
    headerRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      gap: 24,
      marginBottom: 16,
    },
    headerLeft: { flex: 1.1 },
    headerRight: { flex: 1, alignItems: "flex-end" },
    sectionMicro: {
      fontSize: 7,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      color: "#888",
      marginBottom: 2,
    },

    titleRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 10,
      marginBottom: 14,
    },
    title: {
      fontSize: 16,
      fontWeight: "bold",
      color: "#111",
      lineHeight: 1.1,
    },
    docNumberBox: {
      borderWidth: 1,
      borderColor: "#222",
      paddingHorizontal: 8,
      paddingVertical: 4,
      fontSize: 11,
      fontWeight: "bold",
    },

    partyName: { fontSize: 11, fontWeight: "bold", marginBottom: 2 },
    partyLine: { fontSize: 9, color: "#333" },

    // Dates row
    datesRow: {
      flexDirection: "row",
      gap: 24,
      marginBottom: 12,
      fontSize: 9,
    },
    dateLabel: { color: "#666", marginRight: 4 },

    // Payment band
    paymentBand: {
      backgroundColor: accent,
      color: "#fff",
      paddingVertical: 12,
      paddingHorizontal: 14,
      marginVertical: 12,
      flexDirection: "row",
      alignItems: "stretch",
      gap: 16,
      borderRadius: 2,
    },
    paymentCol: { flex: 1 },
    paymentLabel: {
      fontSize: 7,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      color: "rgba(255,255,255,0.85)",
      marginBottom: 3,
    },
    paymentValue: { fontSize: 9, fontWeight: "bold" },
    paymentAmount: { fontSize: 14, fontWeight: "bold", marginTop: 2 },
    qrInBand: {
      width: 70,
      alignItems: "center",
      justifyContent: "center",
    },
    qrInBandImage: { width: 64, height: 64 },
    qrInBandLabel: {
      marginTop: 2,
      fontSize: 6,
      color: "rgba(255,255,255,0.85)",
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },

    // Section heading inside body
    sectionHeading: {
      fontSize: 9,
      fontWeight: "bold",
      color: "#111",
      marginTop: 6,
      marginBottom: 6,
    },

    // Items table
    itemsHeader: {
      flexDirection: "row",
      borderTopWidth: 1,
      borderBottomWidth: 1,
      borderColor: "#222",
      paddingVertical: 4,
      paddingHorizontal: 4,
      fontWeight: "bold",
      fontSize: 8,
    },
    itemsRow: {
      flexDirection: "row",
      paddingVertical: 4,
      paddingHorizontal: 4,
      borderBottomWidth: 0.5,
      borderBottomColor: "#e5e7eb",
    },
    colPos: { width: 18 },
    colDesc: { flex: 1 },
    colQty: { width: 50, textAlign: "right" },
    colUnit: { width: 38 },
    colPrice: { width: 70, textAlign: "right" },
    colRate: { width: 36, textAlign: "right" },
    colNet: { width: 70, textAlign: "right" },
    colVat: { width: 60, textAlign: "right" },
    colTotal: { width: 75, textAlign: "right", fontWeight: "bold" },

    // Recap
    recapWrap: {
      flexDirection: "row",
      justifyContent: "flex-end",
      marginTop: 14,
    },
    recapBox: { width: 320 },
    recapHeader: {
      flexDirection: "row",
      borderBottomWidth: 1,
      borderColor: "#222",
      paddingBottom: 3,
      fontSize: 8,
      fontWeight: "bold",
    },
    recapRow: {
      flexDirection: "row",
      paddingVertical: 3,
      borderBottomWidth: 0.5,
      borderBottomColor: "#e5e7eb",
      fontSize: 9,
    },
    recapColLabel: { width: 90 },
    recapColBase: { width: 110, textAlign: "right" },
    recapColVat: { width: 60, textAlign: "right" },
    recapColTotal: { width: 60, textAlign: "right", fontWeight: "bold" },

    // Pay total bar (Celkem k úhradě)
    payTotalBar: {
      backgroundColor: accent,
      color: "#fff",
      paddingVertical: 10,
      paddingHorizontal: 14,
      marginTop: 14,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      borderRadius: 2,
    },
    payTotalLabel: { fontSize: 11, fontWeight: "bold" },
    payTotalValue: { fontSize: 14, fontWeight: "bold" },

    reverseChargeBox: {
      marginTop: 14,
      padding: 8,
      backgroundColor: "#fffbea",
      borderLeftWidth: 3,
      borderLeftColor: "#eab308",
      fontSize: 9,
      color: "#7c6a10",
    },

    // Signature footer row (signature only — QR moved into payment band)
    signatureBox: {
      marginTop: 24,
      width: 220,
    },
    signatureImage: { height: 40, maxWidth: 200, objectFit: "contain" },
    signatureLine: {
      borderTopWidth: 0.5,
      borderTopColor: "#888",
      marginTop: 6,
      paddingTop: 3,
      fontSize: 8,
      color: "#666",
    },

    footer: {
      position: "absolute",
      left: 36,
      right: 36,
      bottom: 24,
      flexDirection: "row",
      justifyContent: "space-between",
      fontSize: 7,
      color: "#888",
    },

    // Logo (rendered above title in headerRight when present)
    logo: { width: 100, maxHeight: 50, objectFit: "contain", marginBottom: 8 },

    // Legacy styles still consumed by receipt-pdf.tsx
    parties: { flexDirection: "row", gap: 24, marginBottom: 18 },
    partyCol: { flex: 1, minWidth: 0 },
    partyLabel: {
      fontSize: 8,
      textTransform: "uppercase",
      letterSpacing: 1,
      color: "#888",
      marginBottom: 4,
    },
    metaGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      columnGap: 18,
      rowGap: 4,
      backgroundColor: "#f6f7f9",
      padding: 10,
      borderRadius: 3,
      marginBottom: 16,
    },
    metaItem: { minWidth: 120 },
    metaLabel: { fontSize: 7, textTransform: "uppercase", color: "#666", letterSpacing: 0.5 },
    metaValue: { fontSize: 10, color: "#111", fontWeight: "bold" },
    itemsRowAlt: { backgroundColor: "#fafafa" },
    totalsWrap: { flexDirection: "row", justifyContent: "flex-end", marginTop: 12 },
    totalsBox: { width: 260 },
    totalsRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingVertical: 3,
      borderBottomWidth: 0.5,
      borderBottomColor: "#e5e7eb",
    },
    totalsLabel: { color: "#555" },
    totalsValue: { textAlign: "right" },
    grossRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingVertical: 6,
      marginTop: 4,
      backgroundColor: accent,
      color: "#fff",
      paddingHorizontal: 6,
      borderRadius: 3,
    },
    grossLabel: { fontWeight: "bold", fontSize: 11 },
    grossValue: { fontWeight: "bold", fontSize: 11, textAlign: "right" },
    docNumber: { fontSize: 11, color: "#555", marginTop: 2 },
  });
}

export type PdfStyles = ReturnType<typeof buildStyles>;
