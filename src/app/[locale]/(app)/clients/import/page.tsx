import { requireWorkspace } from "@/lib/session";
import { setRequestLocale } from "next-intl/server";
import { BackLink } from "@/components/back-link";
import { ImportForm } from "./form";
import { importClients } from "./actions";

export default async function ClientsImportPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireWorkspace();

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <BackLink href="/clients" label="Clients" />
      <h1 className="text-2xl font-semibold tracking-tight">Import clients & jobs</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Upload a <code>.xlsx</code> or <code>.csv</code> with one row per
        client. Either <code>companyName</code> or <code>fullName</code> is
        required. Existing clients (matched by IČO or email) are skipped.
      </p>

      <details className="mt-4 rounded-lg border border-border bg-card p-4 text-sm">
        <summary className="cursor-pointer font-medium">Column reference</summary>
        <div className="mt-3 space-y-3 text-xs">
          <div>
            <p className="font-semibold">Client columns</p>
            <p className="text-muted-foreground">
              <code>companyName</code> / <code>Firma</code> · <code>fullName</code> / <code>Jméno</code> ·
              <code>ico</code> / <code>IČO</code> · <code>dic</code> / <code>DIČ</code> ·
              <code>email</code> · <code>phone</code> / <code>Telefon</code> ·
              <code>street</code> / <code>Ulice</code> · <code>city</code> / <code>Město</code> ·
              <code>zip</code> / <code>PSČ</code> · <code>country</code> / <code>Země</code> ·
              <code>defaultLanguage</code> (cs/en) · <code>preferredCurrency</code> (CZK/EUR/USD) ·
              <code>notes</code> / <code>Poznámky</code>
            </p>
          </div>
          <div>
            <p className="font-semibold">Optional job columns</p>
            <p className="text-muted-foreground">
              Fill <code>jobTitle</code> / <code>Zakázka</code> on a row to also
              create a job for that client. Optional:
              <code>jobStatus</code> / <code>Stav</code> (SCHEDULED, IN_PROGRESS, COMPLETED, CANCELLED) ·
              <code>siteStreet</code> · <code>siteCity</code> · <code>siteZip</code> ·
              <code>siteCountry</code> · <code>jobNotes</code>. Site address
              defaults to the client&apos;s address when blank.
            </p>
          </div>
          <p className="text-muted-foreground">
            Headers are case-sensitive but tolerate either English or Czech
            names from the list above.
          </p>
        </div>
      </details>

      <div className="mt-8">
        <ImportForm action={importClients} />
      </div>
    </div>
  );
}
