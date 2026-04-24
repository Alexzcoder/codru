import { Font, StyleSheet } from "@react-pdf/renderer";
import path from "node:path";

// Register Roboto (full Czech diacritic coverage). Files live under
// public/fonts so they can be read by absolute path from Node during SSR.
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
  // Czech words like "Opravný" can be long — allow hyphenation-free word wrap.
  Font.registerHyphenationCallback((word) => [word]);
  fontsRegistered = true;
}

export function buildStyles(accent: string) {
  return StyleSheet.create({
    page: {
      paddingTop: 42,
      paddingBottom: 56,
      paddingHorizontal: 42,
      fontFamily: "Roboto",
      fontSize: 9,
      color: "#111",
      lineHeight: 1.35,
    },

    // Header
    letterhead: {
      width: "100%",
      maxHeight: 90,
      objectFit: "contain",
      marginBottom: 16,
    },
    headerRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      marginBottom: 18,
    },
    logo: { width: 110, maxHeight: 60, objectFit: "contain" },
    title: {
      fontSize: 22,
      fontWeight: "bold",
      color: accent,
      lineHeight: 1.15,
      marginBottom: 4,
    },
    docNumber: {
      fontSize: 11,
      color: "#555",
      marginTop: 2,
    },

    // Two-column parties block
    parties: {
      flexDirection: "row",
      gap: 24,
      marginBottom: 18,
    },
    partyCol: { flex: 1, minWidth: 0 },
    partyLabel: {
      fontSize: 8,
      textTransform: "uppercase",
      letterSpacing: 1,
      color: "#888",
      marginBottom: 4,
    },
    partyName: { fontSize: 11, fontWeight: "bold", marginBottom: 2 },
    partyLine: { fontSize: 9, color: "#333" },

    // Meta table (issue date, due date, ...)
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

    // Line items table
    itemsHeader: {
      flexDirection: "row",
      backgroundColor: accent,
      color: "#fff",
      paddingVertical: 4,
      paddingHorizontal: 6,
      fontWeight: "bold",
      fontSize: 8,
      textTransform: "uppercase",
    },
    itemsRow: {
      flexDirection: "row",
      paddingVertical: 4,
      paddingHorizontal: 6,
      borderBottomWidth: 0.5,
      borderBottomColor: "#e5e7eb",
    },
    itemsRowAlt: {
      backgroundColor: "#fafafa",
    },
    colPos: { width: 20 },
    colDesc: { flex: 1 },
    colQty: { width: 50, textAlign: "right" },
    colUnit: { width: 40 },
    colPrice: { width: 65, textAlign: "right" },
    colRate: { width: 35, textAlign: "right" },
    colTotal: { width: 75, textAlign: "right" },

    // Totals block
    totalsWrap: {
      flexDirection: "row",
      justifyContent: "flex-end",
      marginTop: 12,
    },
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

    reverseChargeBox: {
      marginTop: 14,
      padding: 8,
      backgroundColor: "#fffbea",
      borderLeftWidth: 3,
      borderLeftColor: "#eab308",
      fontSize: 9,
      color: "#7c6a10",
    },

    footerBlock: {
      marginTop: 28,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-end",
      gap: 24,
    },
    qrWrap: {
      width: 100,
      alignItems: "center",
    },
    qrImage: { width: 90, height: 90 },
    qrLabel: {
      marginTop: 3,
      fontSize: 7,
      color: "#555",
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },

    signatureBox: {
      width: 200,
    },
    signatureImage: { height: 40, maxWidth: 180, objectFit: "contain" },
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
      left: 42,
      right: 42,
      bottom: 24,
      flexDirection: "row",
      justifyContent: "space-between",
      fontSize: 7,
      color: "#888",
    },
  });
}

export type PdfStyles = ReturnType<typeof buildStyles>;
