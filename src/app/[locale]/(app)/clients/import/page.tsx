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
      <h1 className="text-2xl font-semibold tracking-tight">Import clients</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Upload a .csv or .xlsx with one client per row. Headers should match
        the export columns: companyName, fullName, ico, dic, email, phone,
        street, city, zip, country, defaultLanguage, preferredCurrency, notes.
        Either companyName or fullName is required. Existing clients (matched
        by IČO or email) are skipped.
      </p>
      <div className="mt-8">
        <ImportForm action={importClients} />
      </div>
    </div>
  );
}
