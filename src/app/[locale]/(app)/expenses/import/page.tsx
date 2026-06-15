import { setRequestLocale } from "next-intl/server";
import { requireWorkspace } from "@/lib/session";
import { BackLink } from "@/components/back-link";
import { ReceiptImportForm } from "./import-form";

export const maxDuration = 300;

export default async function ReceiptImportPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireWorkspace();

  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      <BackLink href="/expenses" label="Výdaje" />
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">
        Import účtenek
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Nahrajte fotky účtenek (JPG/PNG). Z každé účtenky se automaticky vytvoří
        jeden výdaj — dodavatel, datum a částky se přečtou z fotky. Po importu je
        zkontrolujte a upravte v seznamu výdajů.
      </p>
      <div className="mt-6">
        <ReceiptImportForm locale={locale} />
      </div>
    </div>
  );
}
