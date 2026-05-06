import { requireWorkspace } from "@/lib/session";
import { setRequestLocale } from "next-intl/server";
import { BackLink } from "@/components/back-link";
import { prisma } from "@/lib/prisma";
import { ImportForm } from "./form";
import { importClients } from "./actions";
import { RecentImports, type RecentBatch } from "./recent-imports";

export default async function ClientsImportPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { workspace } = await requireWorkspace();

  const recentRows = await prisma.importBatch.findMany({
    where: { workspaceId: workspace.id, source: "clients_import_excel" },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
  const recent: RecentBatch[] = recentRows.map((b) => ({
    id: b.id,
    createdAt: b.createdAt.toISOString(),
    filename: b.filename,
    clients: Array.isArray(b.clientIds) ? (b.clientIds as unknown[]).length : 0,
    jobs: Array.isArray(b.jobIds) ? (b.jobIds as unknown[]).length : 0,
    status: b.status === "UNDONE" ? "UNDONE" : "ACTIVE",
    undoneAt: b.undoneAt?.toISOString() ?? null,
  }));

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <BackLink href="/clients" label="Clients" />
      <h1 className="text-2xl font-semibold tracking-tight">Import clients & jobs</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Upload a <code>.xlsx</code> or <code>.csv</code> with one row per
        client. Either <code>companyName</code> or <code>fullName</code> is
        required. Existing clients (matched by IČO or email) are skipped.
        Imported clients default to <strong>PAST</strong> status (override
        with a <code>status</code> column —{" "}
        <code>POTENTIAL / ACTIVE / PAST / FAILED</code>).
      </p>

      <details className="mt-4 rounded-lg border border-border bg-card p-4 text-sm">
        <summary className="cursor-pointer font-medium">Column reference</summary>
        <div className="mt-3 space-y-3 text-xs">
          <div>
            <p className="font-semibold">Client columns</p>
            <p className="text-muted-foreground">
              <strong>Name</strong>: either separate <code>companyName</code> /
              <code>Firma</code> + <code>fullName</code> / <code>Jméno</code>, OR a
              single combined <code>Name</code> column (Raynet-style — we
              auto-detect company by suffix like &ldquo;s.r.o.&rdquo;,
              &ldquo;a.s.&rdquo;).
              <br />
              <strong>Address</strong>: either separate
              <code>street</code> / <code>Ulice</code>, <code>city</code> /
              <code>Město</code>, <code>zip</code> / <code>PSČ</code>, OR a
              single combined <code>Address</code> /
              <code>Adresa</code> column ("Krejnická 2021/1, 14800 Praha")
              that we parse for you.
              <br />
              Other: <code>ico</code> / <code>IČO</code> ·
              <code>dic</code> / <code>DIČ</code> · <code>email</code> ·
              <code>phone</code> / <code>Telefon</code> ·
              <code>country</code> / <code>Země</code> ·
              <code>defaultLanguage</code> (cs/en) ·
              <code>preferredCurrency</code> (CZK/EUR/USD) ·
              <code>notes</code> / <code>Poznámky</code> ·
              <code>source</code> / <code>Source</code> /
              <code>Zdroj</code> (appended as &ldquo;[Source: …]&rdquo; to
              notes).
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

      <RecentImports batches={recent} />
    </div>
  );
}
