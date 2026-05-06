import { setRequestLocale } from "next-intl/server";
import { requireWorkspace } from "@/lib/session";
import { BackLink } from "@/components/back-link";
import { NewSessionForm } from "./form";
import { createDocumentImportSession } from "../actions";

export default async function NewDocImportPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireWorkspace();

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <BackLink href="/imports/documents" label="Document imports" />
      <h1 className="text-2xl font-semibold tracking-tight">
        Import historical PDFs
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Drop one or many PDFs of past quotes, invoices, or credit notes. Claude
        will extract the fields and try to match each to an existing client.
        You&apos;ll get a review screen where you can fix anything before the
        records are actually created.
      </p>

      <details className="mt-4 rounded-lg border border-border bg-card p-4 text-xs">
        <summary className="cursor-pointer font-medium text-sm">
          What happens when I click &ldquo;Start parsing&rdquo;?
        </summary>
        <ol className="mt-3 list-decimal space-y-1 pl-5 text-muted-foreground">
          <li>Each PDF is uploaded once to your workspace storage.</li>
          <li>
            Claude Sonnet 4.6 reads each PDF (multimodal) and extracts the
            type, number, dates, totals, line items, and the receiving
            party&apos;s details.
          </li>
          <li>
            Each parsed result is matched against existing clients by IČO
            first, then email, then fuzzy name.
          </li>
          <li>
            You land on a review screen and approve/edit/skip each one. Real
            records aren&apos;t created until you approve.
          </li>
          <li>
            Cost: roughly $0.04–$0.10 per single-page PDF on Sonnet. The
            session stops if it crosses your cost cap.
          </li>
        </ol>
      </details>

      <div className="mt-8">
        <NewSessionForm action={createDocumentImportSession} />
      </div>
    </div>
  );
}
