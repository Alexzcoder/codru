import { prisma } from "@/lib/prisma";
import { requireWorkspace } from "@/lib/session";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { clientDisplayName } from "@/lib/client-display";
import { ClientListFilters } from "./list-filters";
import { createDemoClient } from "./actions";
import { PageHeader } from "@/components/page-header";
import { ClickableRow } from "@/components/clickable-row";
import { Plus, Download, Sparkles, Upload } from "lucide-react";
import type { ClientStatus } from "@prisma/client";

const PAGE_SIZE = 50;
const VALID_STATUSES: ClientStatus[] = ["POTENTIAL", "ACTIVE", "PAST", "FAILED"];

export default async function ClientsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { workspace } = await requireWorkspace();
  const t = await getTranslations();
  const sp = await searchParams;

  const q = sp.q?.trim() ?? "";
  const statusFilter = VALID_STATUSES.includes(sp.status as ClientStatus)
    ? (sp.status as ClientStatus)
    : undefined;
  const page = Math.max(1, Number(sp.page) || 1);

  const where = {
    workspaceId: workspace.id,
    deletedAt: null,
    ...(statusFilter && { status: statusFilter }),
    ...(q && {
      OR: [
        { companyName: { contains: q, mode: "insensitive" as const } },
        { fullName: { contains: q, mode: "insensitive" as const } },
        { email: { contains: q, mode: "insensitive" as const } },
        { ico: { contains: q } },
      ],
    }),
  };

  const [clients, total] = await Promise.all([
    prisma.client.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.client.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="mx-auto max-w-6xl px-8 py-8">
      <PageHeader
        title={t("Clients.title")}
        description={`${total} ${total === 1 ? "client" : "clients"}`}
        actions={
          <>
            <form action={createDemoClient}>
              <Button type="submit" variant="ghost" size="sm" className="gap-1.5">
                <Sparkles size={14} /> Demo
              </Button>
            </form>
            <Link href="/clients/import">
              <Button variant="outline" size="sm" className="gap-1.5">
                <Upload size={14} /> Import
              </Button>
            </Link>
            <Link href="/clients/export" prefetch={false}>
              <Button variant="outline" size="sm" className="gap-1.5">
                <Download size={14} /> {t("Clients.exportCsv")}
              </Button>
            </Link>
            <Link href="/clients/new">
              <Button size="sm" className="gap-1.5">
                <Plus size={14} /> {t("Clients.newClient")}
              </Button>
            </Link>
          </>
        }
      />

      <div className="mb-6">
        <ClientListFilters initialQ={q} initialStatus={statusFilter ?? "ALL"} />
      </div>

      {clients.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center shadow-sm">
          <p className="text-sm text-muted-foreground">{t("Clients.empty")}</p>
          <Link href="/clients/new" className="mt-4 inline-block">
            <Button size="sm">{t("Clients.emptyCTA")}</Button>
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-secondary/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">{t("Clients.form.type")}</th>
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left">IČO</th>
                <th className="px-4 py-3 text-left">Email</th>
                <th className="px-4 py-3 text-left">{t("Clients.form.status")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {clients.map((c) => (
                <ClickableRow key={c.id} href={`/clients/${c.id}`}>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {t(`Clients.type.${c.type}`)}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/clients/${c.id}`}
                      className="font-medium text-foreground hover:underline"
                    >
                      {clientDisplayName(c)}
                    </Link>
                  </td>
                  <td className="px-4 py-3 tabular-nums text-muted-foreground">{c.ico ?? ""}</td>
                  <td className="px-4 py-3 text-muted-foreground">{c.email ?? ""}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={c.status} label={t(`Clients.status.${c.status}`)} />
                  </td>
                </ClickableRow>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm">
          <p className="text-muted-foreground">
            {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
          </p>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={{
                  pathname: "/clients",
                  query: { ...(q && { q }), ...(statusFilter && { status: statusFilter }), page: page - 1 },
                }}
              >
                <Button variant="outline" size="sm">
                  Prev
                </Button>
              </Link>
            )}
            {page < totalPages && (
              <Link
                href={{
                  pathname: "/clients",
                  query: { ...(q && { q }), ...(statusFilter && { status: statusFilter }), page: page + 1 },
                }}
              >
                <Button variant="outline" size="sm">
                  Next
                </Button>
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status, label }: { status: ClientStatus; label: string }) {
  const cls = {
    POTENTIAL: "bg-amber-100 text-amber-800",
    ACTIVE: "bg-green-100 text-green-800",
    PAST: "bg-secondary text-secondary-foreground",
    FAILED: "bg-red-100 text-red-800",
  }[status];
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs ${cls}`}>{label}</span>
  );
}
