import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { clientDisplayName } from "@/lib/client-display";
import { calculateDocument } from "@/lib/line-items";
import {
  deleteCreditNoteDraft,
  markCreditNoteSent,
} from "../actions";

export default async function CreditNoteDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  await requireUser();
  const t = await getTranslations();

  const doc = await prisma.document.findUnique({
    where: { id },
    include: {
      client: true,
      originalDocument: true,
      lineItems: { orderBy: { position: "asc" } },
      pdfSnapshots: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  if (!doc || doc.type !== "CREDIT_NOTE" || doc.deletedAt) notFound();

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
    await markCreditNoteSent(id);
  };
  const deleteBound = async () => {
    "use server";
    await deleteCreditNoteDraft(id);
  };
  const snapshot = doc.pdfSnapshots[0];

  const originalHref = doc.originalDocument
    ? doc.originalDocument.type === "FINAL_INVOICE"
      ? `/final-invoices/${doc.originalDocument.id}`
      : `/advance-invoices/${doc.originalDocument.id}`
    : "#";

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <p className="text-xs text-muted-foreground">
        <Link href="/credit-notes" className="hover:underline">
          {t("CreditNotes.title")}
        </Link>
        {doc.client && (
          <>
            {" · "}
            <Link href={`/clients/${doc.client.id}`} className="hover:underline">
              {clientDisplayName(doc.client)}
            </Link>
          </>
        )}
        {doc.originalDocument && (
          <>
            {" · "}
            <Link href={originalHref} className="hover:underline">
              {doc.originalDocument.number ?? "original draft"}
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
          {t(`CreditNotes.status.${doc.status === "PAID" ? "APPLIED" : doc.status}`)}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {isDraft && (
          <Link href={`/credit-notes/${id}/edit`}>
            <Button variant="outline" size="sm">
              {t("Settings.edit")}
            </Button>
          </Link>
        )}
        <a href={`/credit-notes/${id}/pdf`} target="_blank" rel="noreferrer">
          <Button variant="outline" size="sm">
            {t("Quotes.actions.previewPdf")} ↗
          </Button>
        </a>
        {isDraft && (
          <form action={sendBound}>
            <Button type="submit" size="sm">
              {t("CreditNotes.actions.markSent")}
            </Button>
          </form>
        )}
        {isDraft && (
          <form action={deleteBound}>
            <Button type="submit" variant="outline" size="sm">
              {t("CreditNotes.actions.delete")}
            </Button>
          </form>
        )}
      </div>

      {doc.creditReason && (
        <div className="mt-6">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            {t("CreditNotes.fields.creditReason")}
          </p>
          <p className="mt-1 whitespace-pre-wrap">{doc.creditReason}</p>
        </div>
      )}

      <div className="mt-8 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-secondary/40 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-2 text-left">#</th>
              <th className="px-4 py-2 text-left">Name</th>
              <th className="px-4 py-2 text-right">Qty</th>
              <th className="px-4 py-2 text-left">Unit</th>
              <th className="px-4 py-2 text-right">Unit price</th>
              <th className="px-4 py-2 text-right">VAT</th>
              <th className="px-4 py-2 text-right">Line total</th>
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
                <td className="px-4 py-2 text-right tabular-nums">{l.quantity.toString()}</td>
                <td className="px-4 py-2">{l.unit}</td>
                <td className="px-4 py-2 text-right tabular-nums">{l.unitPrice.toString()}</td>
                <td className="px-4 py-2 text-right tabular-nums">{l.taxRatePercent.toString()}%</td>
                <td className="px-4 py-2 text-right tabular-nums">
                  {totals.lines[i]?.gross ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-secondary/40">
            <tr>
              <td colSpan={5}></td>
              <td className="px-4 py-2 text-right font-medium">Total</td>
              <td className="px-4 py-2 text-right font-bold tabular-nums">
                {totals.totalGross} {doc.currency}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

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
