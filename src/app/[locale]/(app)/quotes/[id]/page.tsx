import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { clientDisplayName } from "@/lib/client-display";
import { calculateDocument } from "@/lib/line-items";
import {
  autoExpireQuote,
  deleteQuoteDraft,
  markQuoteAccepted,
  markQuoteRejected,
  markQuoteSent,
} from "../actions";

export default async function QuoteDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  await requireUser();
  const t = await getTranslations();

  // Lazy auto-expire on render
  await autoExpireQuote(id);

  const doc = await prisma.document.findUnique({
    where: { id },
    include: {
      client: true,
      job: true,
      companyProfile: true,
      documentTemplate: true,
      lineItems: { orderBy: { position: "asc" } },
      pdfSnapshots: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  if (!doc || doc.type !== "QUOTE" || doc.deletedAt) notFound();

  const totals = calculateDocument({
    lines: doc.lineItems.map((l) => ({
      quantity: l.quantity.toString(),
      unitPrice: l.unitPrice.toString(),
      taxRatePercent: l.taxRatePercent.toString(),
      taxMode: l.taxMode,
      lineDiscountPercent: l.lineDiscountPercent?.toString() ?? null,
      lineDiscountAmount: l.lineDiscountAmount?.toString() ?? null,
    })),
    documentDiscountPercent: doc.documentDiscountPercent?.toString() ?? null,
    documentDiscountAmount: doc.documentDiscountAmount?.toString() ?? null,
    reverseCharge: doc.reverseCharge,
  });

  const isDraft = doc.status === "UNSENT";
  const sendBound = async () => {
    "use server";
    await markQuoteSent(id);
  };
  const acceptBound = async () => {
    "use server";
    await markQuoteAccepted(id);
  };
  const rejectBound = async () => {
    "use server";
    await markQuoteRejected(id);
  };
  const deleteBound = async () => {
    "use server";
    await deleteQuoteDraft(id);
  };

  const snapshot = doc.pdfSnapshots[0];

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <p className="text-xs text-muted-foreground">
        <Link href="/quotes" className="hover:underline">
          {t("Quotes.title")}
        </Link>
        {doc.client && (
          <>
            {" · "}
            <Link href={`/clients/${doc.client.id}`} className="hover:underline">
              {clientDisplayName(doc.client)}
            </Link>
          </>
        )}
      </p>
      <div className="mt-1 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">
          {doc.number ?? (
            <span className="italic text-muted-foreground">{t("Quotes.draftBadge")}</span>
          )}
        </h1>
        <span className="rounded-full bg-secondary px-3 py-1 text-xs">
          {t(`Quotes.status.${doc.status}`)}
        </span>
      </div>

      {/* Actions */}
      <div className="mt-4 flex flex-wrap gap-2">
        <Link href={`/quotes/${id}/edit`}>
          <Button variant="outline" size="sm">
            {t("Settings.edit")}
          </Button>
        </Link>
        <a href={`/quotes/${id}/pdf`} target="_blank" rel="noreferrer">
          <Button variant="outline" size="sm">
            {t("Quotes.actions.previewPdf")} ↗
          </Button>
        </a>
        {isDraft && (
          <form action={sendBound}>
            <Button type="submit" size="sm">
              {t("Quotes.actions.markSent")}
            </Button>
          </form>
        )}
        {(doc.status === "SENT" || doc.status === "EXPIRED") && (
          <form action={acceptBound}>
            <Button type="submit" size="sm">
              {t("Quotes.actions.markAccepted")}
            </Button>
          </form>
        )}
        {doc.status === "SENT" && (
          <form action={rejectBound}>
            <Button type="submit" variant="outline" size="sm">
              {t("Quotes.actions.markRejected")}
            </Button>
          </form>
        )}
        {isDraft && (
          <form action={deleteBound}>
            <Button type="submit" variant="outline" size="sm">
              {t("Quotes.actions.delete")}
            </Button>
          </form>
        )}
        {(doc.status === "SENT" || doc.status === "ACCEPTED") && (
          <>
            <Link href={`/advance-invoices/new?fromQuote=${id}`}>
              <Button variant="outline" size="sm">
                → {t("AdvanceInvoices.new")}
              </Button>
            </Link>
            <Link href={`/final-invoices/new?fromQuote=${id}`}>
              <Button variant="outline" size="sm">
                → {t("FinalInvoices.new")}
              </Button>
            </Link>
          </>
        )}
      </div>

      {/* Meta */}
      <div className="mt-6 grid gap-4 md:grid-cols-4">
        <Info label={t("Quotes.fields.issueDate")}>
          {doc.issueDate.toISOString().slice(0, 10)}
        </Info>
        <Info label={t("Quotes.fields.validUntil")}>
          {doc.validUntilDate?.toISOString().slice(0, 10) ?? "—"}
        </Info>
        <Info label={t("Quotes.fields.currency")}>{doc.currency}</Info>
        <Info label={t("Quotes.fields.locale")}>{doc.locale.toUpperCase()}</Info>
      </div>

      {/* Line items readonly */}
      <div className="mt-8 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-secondary/40 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-2 text-left">{t("Quotes.lineItems.position")}</th>
              <th className="px-4 py-2 text-left">{t("Quotes.lineItems.name")}</th>
              <th className="px-4 py-2 text-right">{t("Quotes.lineItems.qty")}</th>
              <th className="px-4 py-2 text-left">{t("Quotes.lineItems.unit")}</th>
              <th className="px-4 py-2 text-right">{t("Quotes.lineItems.unitPrice")}</th>
              <th className="px-4 py-2 text-right">{t("Quotes.lineItems.taxRate")}</th>
              <th className="px-4 py-2 text-right">{t("Quotes.lineItems.lineTotal")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {doc.lineItems.map((l, i) => (
              <tr key={l.id}>
                <td className="px-4 py-2 text-muted-foreground text-xs">{l.position}</td>
                <td className="px-4 py-2">
                  <div className="font-medium">{l.name}</div>
                  {l.description && (
                    <div className="text-xs text-muted-foreground">{l.description}</div>
                  )}
                </td>
                <td className="px-4 py-2 text-right tabular-nums">
                  {l.quantity.toString()}
                </td>
                <td className="px-4 py-2">{l.unit}</td>
                <td className="px-4 py-2 text-right tabular-nums">
                  {l.unitPrice.toString()}
                </td>
                <td className="px-4 py-2 text-right tabular-nums">
                  {l.taxRatePercent.toString()}%
                </td>
                <td className="px-4 py-2 text-right tabular-nums">
                  {totals.lines[i]?.gross ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-secondary/40">
            <tr>
              <td colSpan={5}></td>
              <td className="px-4 py-2 text-right font-medium">
                {t("Quotes.totals.totalGross")}
              </td>
              <td className="px-4 py-2 text-right font-bold tabular-nums">
                {totals.totalGross} {doc.currency}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {doc.notesToClient && (
        <div className="mt-6">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            {t("Quotes.fields.notesToClient")}
          </p>
          <p className="mt-1 whitespace-pre-wrap">{doc.notesToClient}</p>
        </div>
      )}

      {snapshot && (
        <div className="mt-8 rounded-xl border border-border bg-card shadow-sm p-4 text-sm">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            Archived PDF
          </p>
          <p className="mt-1 text-muted-foreground">
            Created {snapshot.createdAt.toISOString().slice(0, 19).replace("T", " ")} ·{" "}
            <a href={snapshot.filePath} target="_blank" rel="noreferrer" className="underline">
              Download
            </a>
          </p>
        </div>
      )}
    </div>
  );
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 font-medium">{children}</p>
    </div>
  );
}
