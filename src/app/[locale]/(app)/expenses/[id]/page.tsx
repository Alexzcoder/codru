import { prisma } from "@/lib/prisma";
import { requireWorkspace } from "@/lib/session";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { deleteExpense } from "../actions";
import { BackLink } from "@/components/back-link";
import { ConfirmButton } from "@/components/confirm-button";

export default async function ExpenseDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const { workspace } = await requireWorkspace();
  const t = await getTranslations();

  const e = await prisma.expense.findFirst({
    where: { id, workspaceId: workspace.id },
    include: {
      category: true,
      job: true,
      createdBy: { select: { name: true } },
    },
  });
  if (!e) notFound();

  const deleteBound = async () => {
    "use server";
    await deleteExpense(id);
  };

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <BackLink href="/expenses" label={t("Expenses.title")} />
      {e.job && (
        <p className="text-xs text-muted-foreground">
          <Link href={`/jobs/${e.job.id}`} className="hover:underline">
            {e.job.title}
          </Link>
        </p>
      )}
      <div className="mt-1 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{e.description}</h1>
        <span className="rounded-full bg-secondary px-3 py-1 text-sm font-medium tabular-nums">
          {e.totalAmount.toString()} {e.currency}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Link href={`/expenses/${id}/edit`}>
          <Button variant="outline" size="sm">
            {t("Settings.edit")}
          </Button>
        </Link>
        <form action={deleteBound}>
          <ConfirmButton
            label={t("Expenses.actions.delete")}
            message="The expense will be removed permanently."
          />
        </form>
      </div>

      <dl className="mt-6 grid grid-cols-2 gap-y-2 md:grid-cols-4 text-sm">
        <Info label={t("Expenses.fields.date")}>{e.date.toISOString().slice(0, 10)}</Info>
        <Info label={t("Expenses.fields.category")}>{e.category.name}</Info>
        <Info label={t("Expenses.fields.paymentMethod")}>
          {t(`Expenses.methods.${e.paymentMethod}`)}
        </Info>
        <Info label={t("Expenses.fields.supplier")}>{e.supplier ?? "—"}</Info>
        <Info label={t("Expenses.fields.netAmount")}>
          {e.netAmount.toString()} {e.currency}
        </Info>
        <Info label={t("Expenses.fields.vatRate")}>{e.vatRatePercent.toString()}%</Info>
        <Info label={t("Expenses.fields.vatAmount")}>
          {e.vatAmount.toString()} {e.currency}
        </Info>
        <Info label={t("Expenses.fields.totalAmount")}>
          {e.totalAmount.toString()} {e.currency}
        </Info>
        <Info label={t("Expenses.fields.taxDeductible")}>
          {e.taxDeductible ? "Yes" : "No"}
        </Info>
        <Info label={t("Expenses.fields.reverseCharge")}>
          {e.reverseCharge ? "Yes" : "No"}
        </Info>
        <Info label="Logged by">{e.createdBy.name}</Info>
      </dl>

      {e.receiptPath && (
        <div className="mt-6">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            {t("Expenses.fields.receipt")}
          </p>
          {e.receiptPath.endsWith(".pdf") ? (
            <a
              href={e.receiptPath}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-block underline"
            >
              📄 {e.receiptPath}
            </a>
          ) : (
            <a href={e.receiptPath} target="_blank" rel="noreferrer">
              <img
                src={e.receiptPath}
                alt="receipt"
                className="mt-2 max-h-80 rounded-xl border border-border"
              />
            </a>
          )}
        </div>
      )}

      {e.notes && (
        <div className="mt-6">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            {t("Expenses.fields.notes")}
          </p>
          <p className="mt-1 whitespace-pre-wrap text-sm">{e.notes}</p>
        </div>
      )}
    </div>
  );
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-medium">{children}</dd>
    </div>
  );
}
