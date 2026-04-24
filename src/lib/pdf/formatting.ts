import type { PdfLocale } from "./labels";

export function formatDate(d: Date, locale: PdfLocale): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  if (locale === "cs") {
    return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
  }
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function formatMoney(
  amount: string | number,
  currency: string,
  locale: PdfLocale,
): string {
  const n = typeof amount === "string" ? Number.parseFloat(amount) : amount;
  if (locale === "cs") {
    // 1 234,56 Kč
    const formatted = n
      .toFixed(2)
      .replace(/\B(?=(\d{3})+(?!\d))/g, " ")
      .replace(".", ",");
    const symbol = currency === "CZK" ? "Kč" : currency;
    return `${formatted} ${symbol}`;
  }
  // 1,234.56 USD
  const formatted = n
    .toFixed(2)
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${formatted} ${currency}`;
}

export function formatQty(q: string | number): string {
  const n = typeof q === "string" ? Number.parseFloat(q) : q;
  // up to 3 decimals, trim trailing zeros
  return n
    .toFixed(3)
    .replace(/\.?0+$/, "");
}

export function formatPercent(p: string | number): string {
  const n = typeof p === "string" ? Number.parseFloat(p) : p;
  return `${n.toFixed(n % 1 === 0 ? 0 : 2)} %`;
}
