import { setRequestLocale } from "next-intl/server";
import { requireWorkspace } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { ClickableRow } from "@/components/clickable-row";
import { Plus, FileText } from "lucide-react";

export default async function DocImportsListPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { workspace } = await requireWorkspace();

  const sessions = await prisma.documentImportSession.findMany({
    where: { workspaceId: workspace.id },
    orderBy: { createdAt: "desc" },
    take: 30,
    include: {
      items: { select: { status: true } },
      createdBy: { select: { name: true } },
    },
  });

  return (
    <div className="mx-auto max-w-5xl px-8 py-8">
      <PageHeader
        title="Document imports"
        description="Bulk-import historical PDFs of quotes, invoices, and credit notes."
        actions={
          <Link href="/imports/documents/new">
            <Button size="sm" className="gap-1.5">
              <Plus size={14} /> New import
            </Button>
          </Link>
        }
      />

      {sessions.length === 0 ? (
        <div className="mt-12 rounded-xl border border-dashed border-border bg-card p-12 text-center shadow-sm">
          <FileText size={28} className="mx-auto text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">
            No imports yet. Drop a folder of PDFs and Claude will sort them.
          </p>
          <Link href="/imports/documents/new" className="mt-4 inline-block">
            <Button size="sm">Start the first import</Button>
          </Link>
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-secondary/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">Started</th>
                <th className="px-4 py-3 text-left">By</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-right">Files</th>
                <th className="px-4 py-3 text-right">Approved</th>
                <th className="px-4 py-3 text-right">Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sessions.map((s) => {
                const approved = s.items.filter((i) => i.status === "APPROVED").length;
                return (
                  <ClickableRow key={s.id} href={`/imports/documents/${s.id}`}>
                    <td className="px-4 py-3 text-muted-foreground tabular-nums">
                      {s.createdAt.toISOString().slice(0, 16).replace("T", " ")}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {s.createdBy?.name ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-secondary/60 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                        {s.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{s.items.length}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{approved}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      ${Number(s.totalCostUsd).toFixed(2)}
                    </td>
                  </ClickableRow>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
