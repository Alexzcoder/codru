import { setRequestLocale } from "next-intl/server";
import { requireWorkspace } from "@/lib/session";
import { hasFeature } from "@/lib/features";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { AutoRefresh } from "@/components/auto-refresh";
import { ConfirmButton } from "@/components/confirm-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EventTodoList } from "../events/[id]/event-todo-list";
import { createTeam, deleteTeam, toggleTeamMember } from "./actions";

export default async function TasksPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ team?: string; mine?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { user, workspace, membership } = await requireWorkspace();
  if (!hasFeature(workspace, "tasks", membership)) notFound();
  const sp = await searchParams;

  const teams = await prisma.team.findMany({
    where: { workspaceId: workspace.id },
    include: { members: { select: { userId: true } } },
    orderBy: { name: "asc" },
  });
  const teamFilter = teams.some((t) => t.id === sp.team) ? sp.team : undefined;
  const mineOnly = sp.mine === "1";

  const todos = await prisma.eventTodo.findMany({
    where: {
      workspaceId: workspace.id,
      ...(teamFilter ? { teamId: teamFilter } : {}),
      ...(mineOnly ? { assigneeId: user.id } : {}),
    },
    orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { position: "asc" }],
    include: {
      assignee: { select: { id: true, name: true } },
      event: { select: { id: true, name: true } },
      attachments: {
        orderBy: { createdAt: "desc" },
        select: { id: true, filename: true, path: true, kind: true, caption: true },
      },
    },
  });

  const members = await prisma.user.findMany({
    where: {
      deactivatedAt: null,
      memberships: { some: { workspaceId: workspace.id } },
    },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  // Workload: open (not DONE) tasks per member, computed from the unfiltered set.
  const openCounts = await prisma.eventTodo.groupBy({
    by: ["assigneeId"],
    where: { workspaceId: workspace.id, status: { not: "DONE" } },
    _count: true,
  });
  const countFor = (id: string | null) =>
    openCounts.find((c) => c.assigneeId === id)?._count ?? 0;

  const myOpen = todos.filter(
    (t) => t.assigneeId === user.id && t.status !== "DONE",
  );

  const isOwner = membership?.role === "OWNER";

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <AutoRefresh />
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Tasks</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Everything the club is working on — event to-dos and standalone
            tasks — in one board. Updates from teammates appear automatically.
          </p>
        </div>
      </div>

      {/* My tasks */}
      <section className="mt-6 rounded-xl border border-border bg-card p-4 shadow-sm">
        <h2 className="text-sm font-semibold">My tasks ({myOpen.length})</h2>
        {myOpen.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Nothing assigned to you right now.
          </p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {myOpen.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center gap-2 text-sm">
                <span
                  className={`inline-block h-2 w-2 rounded-full ${
                    t.status === "IN_PROGRESS" ? "bg-amber-400" : "bg-neutral-300"
                  }`}
                />
                <span className="font-medium">{t.title}</span>
                {t.event && (
                  <Link
                    href={`/events/${t.event.id}`}
                    className="text-xs text-muted-foreground hover:underline"
                  >
                    {t.event.name}
                  </Link>
                )}
                {t.dueDate && (
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] tabular-nums text-muted-foreground">
                    due {t.dueDate.toISOString().slice(0, 10)}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Workload */}
      <section className="mt-4 flex flex-wrap gap-2">
        {members.map((m) => (
          <span
            key={m.id}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs shadow-sm"
          >
            {m.name}
            <strong className="tabular-nums">{countFor(m.id)}</strong>
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-border px-3 py-1 text-xs text-muted-foreground">
          unassigned <strong className="tabular-nums">{countFor(null)}</strong>
        </span>
      </section>

      {/* Filters */}
      <section className="mt-4 flex flex-wrap items-center gap-1.5 text-xs">
        <FilterChip href="/tasks" active={!teamFilter && !mineOnly} label="All" />
        <FilterChip href="/tasks?mine=1" active={mineOnly} label="Mine" />
        {teams.map((t) => (
          <FilterChip
            key={t.id}
            href={`/tasks?team=${t.id}`}
            active={teamFilter === t.id}
            label={t.name}
          />
        ))}
      </section>

      <div className="mt-4">
        <EventTodoList
          eventId={null}
          todos={todos.map((t) => ({
            id: t.id,
            title: t.title,
            description: t.description,
            status: t.status,
            assigneeId: t.assigneeId,
            assigneeName: t.assignee?.name ?? null,
            teamId: t.teamId,
            eventId: t.event?.id ?? null,
            eventName: t.event?.name ?? null,
            dueDate: t.dueDate ? t.dueDate.toISOString().slice(0, 10) : null,
            attachments: t.attachments.map((a) => ({
              id: a.id,
              filename: a.filename,
              path: a.path,
              kind: a.kind as "IMAGE" | "PDF" | "OTHER",
              caption: a.caption,
            })),
          }))}
          assignees={members}
          teams={teams.map((t) => ({ id: t.id, name: t.name }))}
        />
      </div>

      {/* Teams (committees) — owner manages membership here. */}
      {isOwner && (
        <section className="mt-10">
          <h2 className="text-lg font-medium">Teams</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Committees like Events, Marketing, Podcast. Assign a task to a team
            on its card; filter the board by team above.
          </p>
          <form action={createTeam} className="mt-3 flex max-w-sm gap-2">
            <Input name="name" placeholder="New team name" required maxLength={60} />
            <Button type="submit" size="sm">
              Add
            </Button>
          </form>
          <ul className="mt-4 grid gap-3 md:grid-cols-3">
            {teams.map((t) => {
              const deleteBound = deleteTeam.bind(null, t.id);
              const memberIds = new Set(t.members.map((m) => m.userId));
              return (
                <li
                  key={t.id}
                  className="rounded-xl border border-border bg-card p-4 shadow-sm"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold">{t.name}</p>
                    <form action={deleteBound}>
                      <ConfirmButton
                        label="Delete"
                        message="Tasks assigned to this team keep existing but lose the team."
                      />
                    </form>
                  </div>
                  <ul className="mt-3 space-y-1">
                    {members.map((m) => {
                      const toggleBound = toggleTeamMember.bind(null, t.id, m.id);
                      const inTeam = memberIds.has(m.id);
                      return (
                        <li key={m.id}>
                          <form action={toggleBound}>
                            <button
                              type="submit"
                              className={`w-full cursor-pointer rounded-md px-2 py-1 text-left text-xs transition-colors ${
                                inTeam
                                  ? "bg-primary/10 font-medium text-primary"
                                  : "text-muted-foreground hover:bg-secondary/60"
                              }`}
                            >
                              {inTeam ? "✓ " : ""}
                              {m.name}
                            </button>
                          </form>
                        </li>
                      );
                    })}
                  </ul>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}

function FilterChip({
  href,
  active,
  label,
}: {
  href: string;
  active: boolean;
  label: string;
}) {
  return (
    <Link
      href={href}
      className={`rounded-full px-3 py-1 transition-colors ${
        active
          ? "bg-primary text-primary-foreground"
          : "border border-border bg-card text-muted-foreground hover:text-foreground"
      }`}
    >
      {label}
    </Link>
  );
}
