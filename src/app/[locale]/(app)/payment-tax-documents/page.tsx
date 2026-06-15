import { prisma } from "@/lib/prisma";
import { requireWorkspace } from "@/lib/session";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { clientDisplayName } from "@/lib/client-display";
import { calculateDocument } from "@/lib/line-items";
import { PageHeader } from "@/components/page-header";
import { SearchBar } from "@/components/search-bar";
import { PdfZipExport } from "@/components/pdf-zip-export";

const PAGE_SIZE = 100;

export default async function PaymentTaxDocumentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { workspace } = await requireWorkspace();
  const t = await getTranslations();
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";

  const docs = await prisma.document.findMany({
    where: {
      workspaceId: workspace.id,
      type: "PAYMENT_TAX_DOCUMENT",
      deletedAt: null,
      ...(q && {
        OR: [
          { number: { contains: q, mode: "insensitive" as const } },
          { client: { companyName: { contains: q, mode: "insensitive" as const } } },
          { client: { fullName: { contains: q, mode: "insensitive" as const } } },
        ],
      }),
    },
    include: { client: true, sourceQuote: { select: { number: true } }, lineItems: true },
    orderBy: { issueDate: "desc" },
    take: PAGE_SIZE,
  });

  const f = (k: string) => t(`PaymentTaxDocuments.fields.${k}`);

  return (
    <div className="mx-auto max-w-6xl px-8 py-8">
      <PageHeader
        title={t("PaymentTaxDocuments.title")}
        description={`${docs.length}`}
        actions={
          <PdfZipExport
            action={`/${locale}/payment-tax-documents/export.zip`}
            label={t("Common.pdfZip")}
            allLabel={t("Common.all")}
            statuses={[]}
            q={q || undefined}
          />
        }
      />

      <div className="mb-4">
        <SearchBar
          pathname="/payment-tax-documents"
          initialQ={q}
          placeholder={t("Common.searchByNumberOrClient")}
        />
      </div>

      {docs.length === 0 ? (
        <div className="mt-12 rounded-xl border border-dashed border-border bg-card shadow-sm p-12 text-center">
          <p className="text-sm text-muted-foreground">
            {t("PaymentTaxDocuments.empty")}
          </p>
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-secondary/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left">{f("number")}</th>
                <th className="px-4 py-2 text-left">{f("client")}</th>
                <th className="px-4 py-2 text-left">{f("issueDate")}</th>
                <th className="px-4 py-2 text-left">{f("taxPoint")}</th>
                <th className="px-4 py-2 text-left">{f("forAdvance")}</th>
                <th className="px-4 py-2 text-right">{f("gross")}</th>
                <th className="px-4 py-2 text-right">PDF</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {docs.map((d) => {
                const totals = calculateDocument({
                  lines: d.lineItems.map((l) => ({
                    quantity: l.quantity.toString(),
                    unitPrice: l.unitPrice.toString(),
                    taxRatePercent: l.taxRatePercent.toString(),
                    taxMode: l.taxMode,
                    lineDiscountPercent: l.lineDiscountPercent?.toString() ?? null,
                    lineDiscountAmount: l.lineDiscountAmount?.toString() ?? null,
                    isAdvanceDeduction: l.isAdvanceDeduction,
                  })),
                  documentDiscountPercent: d.documentDiscountPercent?.toString() ?? null,
                  documentDiscountAmount: d.documentDiscountAmount?.toString() ?? null,
                  reverseCharge: d.reverseCharge,
                });
                const pdfHref = `/${locale}/payment-tax-documents/${d.id}/pdf`;
                return (
                  <tr key={d.id} className="hover:bg-secondary/30">
                    <td className="px-4 py-2 font-medium">
                      <a href={pdfHref} target="_blank" rel="noreferrer" className="hover:underline">
                        {d.number ?? "—"}
                      </a>
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">{clientDisplayName(d.client)}</td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {d.issueDate.toISOString().slice(0, 10)}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {(d.taxPointDate ?? d.issueDate).toISOString().slice(0, 10)}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {d.sourceQuote?.number ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {totals.totalGross} {d.currency}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <a
                        href={pdfHref}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary hover:underline"
                      >
                        {t("PaymentTaxDocuments.openPdf")}
                      </a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
