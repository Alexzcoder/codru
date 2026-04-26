import { setRequestLocale } from "next-intl/server";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getActiveWorkspace } from "@/lib/active-workspace";
import { CreateWorkspaceInline } from "./create-form";
import { SwitchAndManage } from "./switch-and-manage";

export default async function WorkspacesSettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireUser();

  const [memberships, active] = await Promise.all([
    prisma.membership.findMany({
      where: { userId: user.id, workspace: { deletedAt: null } },
      include: {
        workspace: {
          include: {
            _count: { select: { memberships: true, clients: true, jobs: true } },
          },
        },
      },
      orderBy: { workspace: { name: "asc" } },
    }),
    getActiveWorkspace(user.id),
  ]);

  return (
    <div>
      <h2 className="text-lg font-semibold tracking-tight">Workspaces</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Each workspace is a separate business with its own clients, jobs,
        invoices, and team. Switch between them from the header.
      </p>

      <ul className="mt-6 divide-y divide-border rounded-xl border border-border bg-card shadow-sm">
        {memberships.map((m) => {
          const isActive = active?.workspace.id === m.workspaceId;
          return (
            <li key={m.id} className="flex items-center justify-between px-4 py-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{m.workspace.name}</span>
                  {isActive && (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
                      Active
                    </span>
                  )}
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                    {m.role === "OWNER" ? "Owner" : "Member"}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {m.workspace._count.memberships}{" "}
                  {m.workspace._count.memberships === 1 ? "member" : "members"}{" "}
                  · {m.workspace._count.clients} clients ·{" "}
                  {m.workspace._count.jobs} jobs
                </p>
              </div>
              <SwitchAndManage
                workspaceId={m.workspaceId}
                isActive={isActive}
                isOwner={m.role === "OWNER"}
              />
            </li>
          );
        })}
      </ul>

      <div className="mt-8 rounded-xl border border-dashed border-border bg-secondary/30 p-4">
        <h3 className="text-sm font-semibold">Create a new workspace</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          You become the OWNER. The new workspace starts empty.
        </p>
        <div className="mt-3">
          <CreateWorkspaceInline />
        </div>
      </div>
    </div>
  );
}
