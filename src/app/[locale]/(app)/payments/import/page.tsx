import { requireWorkspace } from "@/lib/session";
import { setRequestLocale } from "next-intl/server";
import { BackLink } from "@/components/back-link";
import { ImportForm } from "./form";
import { importPayments } from "./actions";

export default async function PaymentsImportPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireWorkspace();

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <BackLink href="/payments" label="Payments" />
      <h1 className="text-2xl font-semibold tracking-tight">Import bank statement</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Upload a .csv or .xlsx exported from your bank. Required columns:
        <code className="mx-1 rounded bg-secondary/60 px-1">date</code>
        <code className="mx-1 rounded bg-secondary/60 px-1">amount</code>
        <code className="mx-1 rounded bg-secondary/60 px-1">VS</code>
        (variable symbol). Outgoing rows are ignored. Each incoming row is
        matched to an open invoice by VS — matched amounts are allocated and
        the invoice status flips to Paid / Partially paid.
      </p>
      <div className="mt-8">
        <ImportForm action={importPayments} />
      </div>
    </div>
  );
}
