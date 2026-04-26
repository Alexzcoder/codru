import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { clientDisplayName } from "@/lib/client-display";
import { calculateDocument } from "@/lib/line-items";
import {
  autoOverdueFinal,
  cancelFinal,
  deleteFinalDraft,
  markFinalPaid,
  markFinalSent,
} from "../actions";
import { loadCreditNotesForOriginal } from "@/lib/credit-notes-summary";
import { BackLink } from "@/components/back-link";
import { EmailComposerButton } from "@/components/email-composer";
import { EmailHistory } from "@/components/email-history";
import { ConfirmButton } from "@/components/confirm-button";
import { documentStatusClass } from "@/lib/status-style";

export default async function FinalInvoiceDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  await requireUser();
  const t = await getTranslations();

  await autoOverdueFinal(id);

  const doc = await prisma.document.findUnique({
    where: { id },
    include: {
      client: true,
      job: true,
      sourceQuote: true,
      lineItems: { orderBy: { position: "asc" } },
      advanceDeductions: { include: { advance: true } },
      paymentAllocations: {
        include: { payment: { select: { id: true, date: true, method: true, reference: true } } },
        orderBy: { id: "asc" },
      },
      pdfSnapshots: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  if (!doc || doc.type !== "FINAL_INVOICE" || doc.deletedAt) notFound();

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
    await markFinalSent(id);
  };
  const payBound = async () => {
    "use server";
    await markFinalPaid(id);
  };
  const deleteBound = async () => {
    "use server";
    await deleteFinalDraft(id);
  };
  const cancelBound = async () => {
    "use server";
    await cancelFinal(id);
  };

  const snapshot = doc.pdfSnapshots[0];
  const creditNotes = await loadCreditNotesForOriginal(id);
  const effectiveGross =
    (Number.parseFloat(totals.totalGross) -
      Number.parseFloat(creditNotes.effectiveReduction)).toFixed(2);

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <BackLink href="/final-invoices" label={t("FinalInvoices.title")} />
      {(doc.client || doc.job) && (
        <p className="text-xs text-muted-foreground">
          {doc.client && (
            <Link href={`/clients/${doc.client.id}`} className="hover:underline">
              {clientDisplayName(doc.client)}
            </Link>
          )}
          {doc.client && doc.job && " · "}
          {doc.job && (
            <Link href={`/jobs/${doc.job.id}`} className="hover:underline">
              {doc.job.title}
            </Link>
          )}
        </p>
      )}
      <div className="mt-1">
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
      <div className="mt-2">
        <span
          className={`rounded-full px-3 py-1 text-xs font-medium ${documentStatusClass(doc.status)}`}
        >
          {t(`FinalInvoices.status.${doc.status}`)}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Link href={`/final-invoices/${id}/edit`}>
          <Button variant="outline" size="sm">
            {t("Settings.edit")}
          </Button>
        </Link>
        <a href={`/final-invoices/${id}/pdf`} target="_blank" rel="noreferrer">
          <Button variant="outline" size="sm">
            {t("Quotes.actions.previewPdf")} ↗
          </Button>
        </a>
        <a href={`/final-invoices/${id}/pdf?download=1`} download>
          <Button variant="outline" size="sm">
            Download PDF ↓
          </Button>
        </a>
        <EmailComposerButton documentId={id} />
        {isDraft && (
          <form action={sendBound}>
            <Button type="submit" size="sm">
              {t("FinalInvoices.actions.markSent")}
            </Button>
          </form>
        )}
        {(doc.status === "SENT" || doc.status === "OVERDUE") && (
          <form action={payBound}>
            <Button type="submit" size="sm">
              {t("FinalInvoices.actions.markPaid")}
            </Button>
          </form>
        )}
        {isDraft && (
          <form action={deleteBound}>
            <ConfirmButton
              label={t("FinalInvoices.actions.delete")}
              message="The draft will be permanently removed."
            />
          </form>
        )}
        {(doc.status === "SENT" || doc.status === "OVERDUE" || doc.status === "PARTIALLY_PAID") && (
          <form action={cancelBound}>
            <ConfirmButton
              label={t("FinalInvoices.actions.cancel")}
              message="The invoice will be marked Cancelled. If a payment was already received, issue a credit note instead."
            />
          </form>
        )}
        {!isDraft && doc.status !== "CANCELLED" && (
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
        <Info label={t("FinalInvoices.fields.taxPointDate")}>
          {doc.taxPointDate?.toISOString().slice(0, 10) ?? "—"}
        </Info>
        <Info label={t("FinalInvoices.fields.dueDate")}>
          {doc.dueDate?.toISOString().slice(0, 10) ?? "—"}
        </Info>
        <Info label={t("Quotes.fields.currency")}>{doc.currency}</Info>
      </div>

      {doc.advanceDeductions.length > 0 && (
        <div className="mt-6 rounded-xl border border-border bg-card shadow-sm p-4 text-sm">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            Deducted advances
          </p>
          <ul className="mt-2 space-y-1">
            {doc.advanceDeductions.map((d) => (
              <li key={d.advanceId}>
                <Link
                  href={`/advance-invoices/${d.advanceId}`}
                  className="hover:underline"
                >
                  {d.advance.number ?? t("Common.draft")}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {doc.paymentAllocations.length > 0 && (
        <div className="mt-6 rounded-xl border border-border bg-card shadow-sm p-4 text-sm">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            Payments received
          </p>
          <ul className="mt-2 space-y-1">
            {doc.paymentAllocations.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3">
                <Link
                  href={`/payments/${a.payment.id}`}
                  className="text-muted-foreground hover:underline"
                >
                  {a.payment.date.toISOString().slice(0, 10)} ·{" "}
                  {t(`Payments.methods.${a.payment.method}`)}
                  {a.payment.reference ? ` · ${a.payment.reference}` : ""}
                </Link>
                <span className="tabular-nums font-medium">
                  {Number(a.amount).toFixed(2)} {doc.currency}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

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
                  {n.number ?? t("Common.draft")} ·{" "}
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
