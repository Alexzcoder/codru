import { prisma } from "@/lib/prisma";
import { requireWorkspaceOwner } from "@/lib/session";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { InviteForm } from "./invite-form";
import { UserRow } from "./user-row";

export default async function UsersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { user: owner, workspace } = await requireWorkspaceOwner();
  const t = await getTranslations();

  const [users, pendingInvites] = await Promise.all([
    prisma.user.findMany({
      where: { memberships: { some: { workspaceId: workspace.id } } },
      orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    }),
    prisma.invite.findMany({
      where: { workspaceId: workspace.id, acceptedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <div>
      <h2 className="text-lg font-semibold tracking-tight">{t("Settings.navUsers")}</h2>

      <div className="mt-6 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-secondary/40 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-2 text-left">{t("Settings.fields.name")}</th>
              <th className="px-4 py-2 text-left">Email</th>
              <th className="px-4 py-2 text-left">{t("Settings.fields.role")}</th>
              <th className="px-4 py-2 text-left">{t("Settings.fields.status")}</th>
              <th className="px-4 py-2 text-left">{t("Settings.fields.lastLogin")}</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {users.map((u) => (
              <UserRow key={u.id} user={u} isSelf={u.id === owner.id} />
            ))}
          </tbody>
        </table>
      </div>

      {pendingInvites.length > 0 && (
        <div className="mt-8">
          <h3 className="text-sm font-medium">Pending invites</h3>
          <ul className="mt-3 divide-y divide-border rounded-xl border border-border bg-card shadow-sm text-sm">
            {pendingInvites.map((i) => (
              <li key={i.id} className="flex justify-between px-4 py-2">
                <span>{i.email}</span>
                <span className="text-xs text-muted-foreground">
                  expires {i.expiresAt.toISOString().slice(0, 16).replace("T", " ")}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-8">
        <h3 className="text-sm font-medium">{t("Settings.users.invite")}</h3>
        <div className="mt-3">
          <InviteForm />
        </div>
      </div>
    </div>
  );
}
