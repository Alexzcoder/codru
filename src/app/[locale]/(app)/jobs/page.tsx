import { prisma } from "@/lib/prisma";
import { requireWorkspace } from "@/lib/session";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { clientDisplayName } from "@/lib/client-display";
import { JobListFilters } from "./list-filters";
import { BulkActions } from "./bulk-actions";
import { createDemoJob } from "./actions";
import { PageHeader } from "@/components/page-header";
import { Plus, Sparkles } from "lucide-react";
import type { JobStatus } from "@prisma/client";

const PAGE_SIZE = 50;
const VALID_STATUSES: JobStatus[] = [
  "SCHEDULED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
];

export default async function JobsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    q?: string;
    status?: string;
    clientId?: string;
    assigneeId?: string;
    from?: string;
    to?: string;
    page?: string;
  }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { workspace } = await requireWorkspace();
  const t = await getTranslations();
  const sp = await searchParams;

  const q = sp.q?.trim() ?? "";
  // "active" is the new default — only Scheduled + In progress. Pick "all" or
  // a specific status to broaden. Completed/Cancelled jobs land in History.
  const rawStatus = sp.status ?? "active";
  const statusFilter = VALID_STATUSES.includes(rawStatus as JobStatus)
    ? (rawStatus as JobStatus)
    : undefined;
  const isActiveDefault = rawStatus === "active";
  const isAll = rawStatus === "all";
  const page = Math.max(1, Number(sp.page) || 1);

  const where = {
    workspaceId: workspace.id,
    ...(statusFilter
      ? { status: statusFilter }
      : isActiveDefault
        ? { status: { in: ["SCHEDULED", "IN_PROGRESS"] as JobStatus[] } }
        : isAll
          ? {}
          : {}),
    ...(sp.clientId && { clientId: sp.clientId }),
    ...(sp.assigneeId && { assignments: { some: { userId: sp.assigneeId } } }),
    ...(sp.from && { scheduledStart: { gte: new Date(sp.from) } }),
    ...(sp.to && { scheduledStart: { lte: new Date(sp.to) } }),
    ...(q && {
      OR: [
        { title: { contains: q, mode: "insensitive" as const } },
        { client: { companyName: { contains: q, mode: "insensitive" as const } } },
        { client: { fullName: { contains: q, mode: "insensitive" as const } } },
      ],
    }),
  };

  const [jobs, total, clients, users] = await Promise.all([
    prisma.job.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        client: true,
        assignments: { include: { user: { select: { name: true, calendarColor: true } } } },
      },
    }),
    prisma.job.count({ where }),
    prisma.client.findMany({
      where: { workspaceId: workspace.id, deletedAt: null, anonymizedAt: null },
      select: { id: true, type: true, companyName: true, fullName: true, anonymizedAt: true },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.user.findMany({
      where: { deactivatedAt: null, memberships: { some: { workspaceId: workspace.id } } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="mx-auto max-w-6xl px-8 py-8">
      <PageHeader
        title={t("Jobs.title")}
        description={`${total} ${total === 1 ? "job" : "jobs"}`}
        actions={
          <>
            <form action={createDemoJob}>
              <Button type="submit" variant="ghost" size="sm" className="gap-1.5">
                <Sparkles size={14} /> Demo
              </Button>
            </form>
            <Link href="/jobs/new">
              <Button size="sm" className="gap-1.5">
                <Plus size={14} /> {t("Jobs.newJob")}
              </Button>
            </Link>
          </>
        }
      />

      <div className="mt-0 mb-6">
        <JobListFilters
          initial={{
            q,
            status: statusFilter ?? (isAll ? "ALL" : "ACTIVE"),
            clientId: sp.clientId ?? "",
            assigneeId: sp.assigneeId ?? "",
            from: sp.from ?? "",
            to: sp.to ?? "",
          }}
          clients={clients.map((c) => ({
            id: c.id,
            name: clientDisplayName(c),
          }))}
          users={users}
        />
      </div>

      {jobs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center shadow-sm">
          <p className="text-sm text-muted-foreground">{t("Jobs.empty")}</p>
          <Link href="/jobs/new" className="mt-4 inline-block">
            <Button size="sm">{t("Jobs.emptyCTA")}</Button>
          </Link>
        </div>
      ) : (
        <BulkActions
          jobs={jobs.map((j) => ({
            id: j.id,
            title: j.title,
            clientName: clientDisplayName(j.client),
            status: j.status,
            scheduledStart: j.scheduledStart?.toISOString() ?? null,
            assigneeColors: j.assignments.map((a) => a.user.calendarColor),
          }))}
        />
      )}

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm">
          <p className="text-muted-foreground">
            {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
          </p>
          <div className="flex gap-2">
            {page > 1 && (
              <Link href={{ pathname: "/jobs", query: { ...sp, page: page - 1 } }}>
                <Button variant="outline" size="sm">
                  Prev
                </Button>
              </Link>
            )}
            {page < totalPages && (
              <Link href={{ pathname: "/jobs", query: { ...sp, page: page + 1 } }}>
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
