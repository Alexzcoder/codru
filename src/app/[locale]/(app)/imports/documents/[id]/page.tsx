import { setRequestLocale } from "next-intl/server";
import { requireWorkspace } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { BackLink } from "@/components/back-link";
import { ItemReviewCard } from "./item-review-card";
import { FinalizeButton } from "./finalize-button";

export default async function ImportSessionReviewPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const { workspace } = await requireWorkspace();

  const session = await prisma.documentImportSession.findFirst({
    where: { id, workspaceId: workspace.id },
    include: {
      items: {
        orderBy: { createdAt: "asc" },
        include: {
          matchedClient: {
            select: { id: true, type: true, companyName: true, fullName: true, ico: true, email: true },
          },
          createdDocument: {
            select: { id: true, type: true, number: true },
          },
        },
      },
    },
  });
  if (!session) notFound();

  const clients = await prisma.client.findMany({
    where: { workspaceId: workspace.id, deletedAt: null },
    orderBy: [{ companyName: "asc" }, { fullName: "asc" }],
    select: { id: true, type: true, companyName: true, fullName: true, ico: true },
  });

  const counts = {
    parsed: session.items.filter((i) => i.status === "PARSED").length,
    approved: session.items.filter((i) => i.status === "APPROVED").length,
    skipped: session.items.filter((i) => i.status === "SKIPPED").length,
    failed: session.items.filter((i) => i.status === "FAILED").length,
  };
  const allHandled = counts.parsed === 0;

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <BackLink href="/imports/documents" label="Document imports" />
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Review &amp; approve
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            {session.items.length} files · {counts.approved} approved ·{" "}
            {counts.skipped} skipped · {counts.parsed} pending ·{" "}
            {counts.failed} failed · spent $
            {Number(session.totalCostUsd).toFixed(3)}
          </p>
        </div>
        <FinalizeButton sessionId={session.id} disabled={!allHandled || session.status === "FINALIZED"} />
      </div>

      {session.status === "FINALIZED" && (
        <div className="mt-4 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-900">
          Session finalized {session.finalizedAt?.toISOString().slice(0, 10)}.
        </div>
      )}

      <div className="mt-6 space-y-4">
        {session.items.map((item) => (
          <ItemReviewCard
            key={item.id}
            item={{
              id: item.id,
              filename: item.filename,
              storedPath: item.storedPath,
              status: item.status,
              parseError: item.parseError,
              parsed: item.parsed as unknown as Record<string, unknown> | null,
              matchedClient: item.matchedClient,
              matchConfidence: item.matchConfidence ? Number(item.matchConfidence) : null,
              costUsd: Number(item.costUsd),
              createdDocument: item.createdDocument,
            }}
            clients={clients.map((c) => ({
              id: c.id,
              label:
                (c.companyName ?? c.fullName ?? "—") +
                (c.ico ? ` · ${c.ico}` : ""),
            }))}
          />
        ))}
      </div>

      {session.items.length === 0 && (
        <p className="mt-12 rounded-xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
          This session has no items.{" "}
          <Link href="/imports/documents/new" className="underline">
            Start a new one
          </Link>
          .
        </p>
      )}
    </div>
  );
}
