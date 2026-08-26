import { setRequestLocale } from "next-intl/server";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { BackLink } from "@/components/back-link";
import { FEATURES, readFeatureFlags, readMemberScopes } from "@/lib/features";
import { FeatureToggles } from "./feature-toggles";
import { MemberScopes } from "./member-scopes";
import { AddExistingMember } from "./add-existing-member";
import { rotateJoinLink, disableJoinLink } from "../../../workspace-actions";

export default async function WorkspaceDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const user = await requireUser();

  const membership = await prisma.membership.findUnique({
    where: { workspaceId_userId: { workspaceId: id, userId: user.id } },
    include: { workspace: true },
  });
  if (!membership) notFound();
  const isOwner = membership.role === "OWNER";
  const ws = membership.workspace;
  const flags = readFeatureFlags(ws);
  const rotateBound = rotateJoinLink.bind(null, ws.id);
  const disableBound = disableJoinLink.bind(null, ws.id);

  const otherMembers = isOwner
    ? await prisma.membership.findMany({
        where: { workspaceId: id, role: "MEMBER" },
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { user: { email: "asc" } },
      })
    : [];

  // Candidates for "add existing teammate" — users already in another
  // workspace I OWN, but not in this one. Dedupe by userId; surface the
  // first sibling workspace name purely as context.
  type Candidate = {
    id: string;
    name: string | null;
    email: string;
    fromWorkspaceName: string;
  };
  let addCandidates: Candidate[] = [];
  if (isOwner) {
    const sibling = await prisma.membership.findMany({
      where: {
        workspaceId: { not: id },
        workspace: {
          deletedAt: null,
          memberships: { some: { userId: user.id, role: "OWNER" } },
        },
        user: { deactivatedAt: null, id: { not: user.id } },
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
        workspace: { select: { name: true } },
      },
    });
    const alreadyHere = new Set(otherMembers.map((m) => m.user.id));
    const seen = new Set<string>();
    for (const m of sibling) {
      if (alreadyHere.has(m.user.id)) continue;
      if (seen.has(m.user.id)) continue;
      seen.add(m.user.id);
      addCandidates.push({
        id: m.user.id,
        name: m.user.name,
        email: m.user.email,
        fromWorkspaceName: m.workspace.name,
      });
    }
    addCandidates.sort((a, b) => a.email.localeCompare(b.email));
  }

  return (
    <div>
      <BackLink href="/settings/workspaces" label="Workspaces" />
      <h2 className="text-lg font-semibold tracking-tight">{ws.name}</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Slug <code className="rounded bg-secondary/60 px-1">{ws.slug}</code>
      </p>

      <section className="mt-8">
        <h3 className="text-sm font-semibold">Features</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Toggle optional tabs that appear in the sidebar for this workspace.
          Per-tenant: turning a feature off here doesn&apos;t affect other workspaces.
        </p>
        {isOwner ? (
          <div className="mt-4">
            <FeatureToggles
              workspaceId={ws.id}
              definitions={FEATURES}
              initial={flags}
            />
          </div>
        ) : (
          <ul className="mt-4 space-y-1 text-sm text-muted-foreground">
            {(Object.keys(FEATURES) as Array<keyof typeof FEATURES>).map((k) => (
              <li key={k}>
                {FEATURES[k].label}: <strong>{flags[k] ? "on" : "off"}</strong>
              </li>
            ))}
          </ul>
        )}
      </section>

      {isOwner && (
        <section className="mt-10">
          <h3 className="text-sm font-semibold">Join link</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Share one link and anyone who opens it can create an account and
            join <strong>this workspace only</strong> as a member — like a
            shared Notion page. Rotate to revoke the old link; disable to turn
            it off.
          </p>
          {ws.joinToken ? (
            <div className="mt-3 space-y-3">
              <code className="block w-full select-all break-all rounded-md border border-border bg-secondary/40 px-3 py-2 text-xs">
                {`${process.env.APP_URL ?? "http://localhost:3000"}/join/${ws.joinToken}`}
              </code>
              <div className="flex gap-2">
                <form action={rotateBound}>
                  <button
                    type="submit"
                    className="cursor-pointer rounded-md border border-border px-3 py-1.5 text-xs hover:bg-secondary/60"
                  >
                    Rotate link
                  </button>
                </form>
                <form action={disableBound}>
                  <button
                    type="submit"
                    className="cursor-pointer rounded-md border border-border px-3 py-1.5 text-xs text-red-600 hover:bg-secondary/60"
                  >
                    Disable link
                  </button>
                </form>
              </div>
            </div>
          ) : (
            <form action={rotateBound} className="mt-3">
              <button
                type="submit"
                className="cursor-pointer rounded-md border border-border px-3 py-1.5 text-xs hover:bg-secondary/60"
              >
                Enable join link
              </button>
            </form>
          )}
        </section>
      )}

      {isOwner && (
        <section className="mt-10">
          <h3 className="text-sm font-semibold">Add existing teammate</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Grant access to someone who&apos;s already in another workspace you
            own — no email invite needed.
          </p>
          <div className="mt-4">
            <AddExistingMember workspaceId={ws.id} candidates={addCandidates} />
          </div>
        </section>
      )}

      {isOwner && otherMembers.length > 0 && (
        <section className="mt-10">
          <h3 className="text-sm font-semibold">Member access</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Restrict what each member sees. Leave everything ticked for full
            access. Untick to create custom roles like &ldquo;Event Officer&rdquo;
            who only sees Events.
          </p>
          <div className="mt-4 space-y-3">
            {otherMembers.map((m) => (
              <MemberScopes
                key={m.id}
                workspaceId={ws.id}
                member={{
                  id: m.user.id,
                  name: m.user.name,
                  email: m.user.email,
                }}
                definitions={FEATURES}
                initialScopes={readMemberScopes(m)}
                workspaceFlags={flags}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
