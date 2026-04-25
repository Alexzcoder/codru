import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { clientDisplayName } from "@/lib/client-display";
import { calculateDocument } from "@/lib/line-items";
import {
  autoOverdue,
  deleteAdvanceDraft,
  markAdvancePaid,
  markAdvanceSent,
} from "../actions";
import { loadCreditNotesForOriginal } from "@/lib/credit-notes-summary";
import { BackLink } from "@/components/back-link";
import { EmailComposerButton } from "@/components/email-composer";
import { EmailHistory } from "@/components/email-history";

export default async function AdvanceInvoiceDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  await requireUser();
  const t = await getTranslations();

  await autoOverdue(id);

  const doc = await prisma.document.findUnique({
    where: { id },
    include: {
      client: true,
      job: true,
      sourceQuote: true,
      lineItems: { orderBy: { position: "asc" } },
      pdfSnapshots: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  if (!doc || doc.type !== "ADVANCE_INVOICE" || doc.deletedAt) notFound();

  const totals = calculateDocument({
    lines: doc.lineItems.map((l) => ({
      quantity: l.quantity.toString(),
      unitPrice: l.unitPrice.toString(),
      taxRatePercent: l.taxRatePercent.toString(),
      taxMode: l.taxMode,
      lineDiscountPercent: l.lineDiscountPercent?.toString() ?? null,
      lineDiscountAmount: l.lineDiscountAmount?.toString() ?? null,
    })),
    reverseCharge: doc.reverseCharge,
  });

  const isDraft = doc.status === "UNSENT";
  const sendBound = async () => {
    "use server";
    await markAdvanceSent(id);
  };
  const payBound = async () => {
    "use server";
    await markAdvancePaid(id);
  };
  const deleteBound = async () => {
    "use server";
    await deleteAdvanceDraft(id);
  };

  const snapshot = doc.pdfSnapshots[0];
  const ppc = doc.status === "PAID_PENDING_COMPLETION";
  const creditNotes = await loadCreditNotesForOriginal(id);
  const effectiveGross =
    (Number.parseFloat(totals.totalGross) -
      Number.parseFloat(creditNotes.effectiveReduction)).toFixed(2);

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <BackLink href="/advance-invoices" label={t("AdvanceInvoices.title")} />
      {(doc.client || doc.sourceQuote) && (
        <p className="text-xs text-muted-foreground">
          {doc.client && (
            <Link href={`/clients/${doc.client.id}`} className="hover:underline">
              {clientDisplayName(doc.client)}
            </Link>
          )}
          {doc.client && doc.sourceQuote && " · "}
          {doc.sourceQuote && (
            <Link href={`/quotes/${doc.sourceQuote.id}`} className="hover:underline">
              {doc.sourceQuote.number ?? "draft quote"}
            </Link>
          )}
        </p>
      )}
      <div className="mt-1 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">
            {doc.title ??
              doc.number ?? (
                <span className="italic text-muted-foreground">{t("Quotes.draftBadge")}</span>
              )}
          </h1>
          {doc.title && doc.number && (
            <p className="text-xs text-muted-foreground">{doc.number}</p>
          )}
        </div>
        <span className="rounded-full bg-secondary px-3 py-1 text-xs">
          {t(`AdvanceInvoices.status.${doc.status}`)}
        </span>
      </div>

      {ppc && (
        <p className="mt-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {t("AdvanceInvoices.ppcHint")}
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <Link href={`/advance-invoices/${id}/edit`}>
          <Button variant="outline" size="sm">
            {t("Settings.edit")}
          </Button>
        </Link>
        <a href={`/advance-invoices/${id}/pdf`} target="_blank" rel="noreferrer">
          <Button variant="outline" size="sm">
            {t("Quotes.actions.previewPdf")} ↗
          </Button>
        </a>
        <a href={`/advance-invoices/${id}/pdf?download=1`} download>
          <Button variant="outline" size="sm">
            Download PDF ↓
          </Button>
        </a>
        <EmailComposerButton documentId={id} />
        {isDraft && (
          <form action={sendBound}>
            <Button type="submit" size="sm">
              {t("AdvanceInvoices.actions.markSent")}
            </Button>
          </form>
        )}
        {(doc.status === "SENT" || doc.status === "OVERDUE") && (
          <form action={payBound}>
            <Button type="submit" size="sm">
              {t("AdvanceInvoices.actions.markPaid")}
            </Button>
          </form>
        )}
        {isDraft && (
          <form action={deleteBound}>
            <Button type="submit" variant="outline" size="sm">
              {t("AdvanceInvoices.actions.delete")}
            </Button>
          </form>
        )}
        {!isDraft && (
          <Link href={`/credit-notes/new?fromInvoice=${id}`}>
            <Button variant="outline" size="sm">
              → {t("CreditNotes.new")}
            </Button>
          </Link>
        )}
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-4">
        <Info label={t("Quotes.fields.issueDate")}>
          {doc.issueDate.toISOString().slice(0, 10)}
        </Info>
        <Info label={t("AdvanceInvoices.fields.taxPointDate")}>
          {doc.taxPointDate?.toISOString().slice(0, 10) ?? "—"}
        </Info>
        <Info label={t("AdvanceInvoices.fields.dueDate")}>
          {doc.dueDate?.toISOString().slice(0, 10) ?? "—"}
        </Info>
        <Info label={t("Quotes.fields.currency")}>{doc.currency}</Info>
      </div>

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

      {creditNotes.notes.length > 0 && (
        <div className="mt-6 rounded-xl border border-border bg-card shadow-sm p-4 text-sm">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            {t("CreditNotes.linkedCreditNotes")}
          </p>
          <ul className="mt-2 space-y-1">
            {creditNotes.notes.map((n) => (
              <li key={n.id} className="flex items-center justify-between">
                <Link href={`/credit-notes/${n.id}`} className="hover:underline">
                  {n.number ?? "(draft)"} ·{" "}
                  <span className="text-xs text-muted-foreground">
                    {t(`CreditNotes.status.${n.status === "PAID" ? "APPLIED" : n.status}`)}
                  </span>
                </Link>
                <span className="tabular-nums">
                  {n.totalGross} {n.currency}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex items-center justify-between border-t border-border pt-3 font-medium">
            <span>{t("CreditNotes.effectiveBalance")}</span>
            <span className="tabular-nums">
              {effectiveGross} {doc.currency}
            </span>
          </div>
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

      <EmailHistory documentId={id} />
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
