import { setRequestLocale } from "next-intl/server";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { BackLink } from "@/components/back-link";
import { FEATURES, readFeatureFlags } from "@/lib/features";
import { FeatureToggles } from "./feature-toggles";

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
    </div>
  );
}
