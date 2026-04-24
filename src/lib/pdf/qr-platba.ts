import QRCode from "qrcode";

// Czech Short Payment Descriptor (SPD) — standard for QR platba.
// Format: SPD*1.0*ACC:{IBAN}*AM:{amount}*CC:{currency}*MSG:{msg}*X-VS:{vs}
// See https://qr-platba.cz/pro-vyvojare/ for full field list.

export type QrPlatbaInput = {
  iban: string;
  amount: string; // decimal string; will be formatted with dot
  currency?: string; // default CZK
  message?: string;
  variableSymbol?: string;
};

export function buildSpdString(input: QrPlatbaInput): string {
  const parts: string[] = ["SPD*1.0"];
  parts.push(`ACC:${input.iban.replace(/\s+/g, "")}`);
  const amt = Number.parseFloat(input.amount).toFixed(2);
  parts.push(`AM:${amt}`);
  parts.push(`CC:${(input.currency ?? "CZK").toUpperCase()}`);
  if (input.variableSymbol) {
    parts.push(`X-VS:${input.variableSymbol.replace(/\D/g, "")}`);
  }
  if (input.message) {
    // SPD spec: replace '*' and '\' in free-text fields.
    const msg = input.message.replace(/[*\\]/g, " ").slice(0, 60);
    parts.push(`MSG:${msg}`);
  }
  return parts.join("*");
}

export async function buildQrPlatbaDataUrl(
  input: QrPlatbaInput,
): Promise<string | null> {
  if (!input.iban) return null;
  const spd = buildSpdString(input);
  return QRCode.toDataURL(spd, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 360,
  });
}
