import { setRequestLocale } from "next-intl/server";
import { requireWorkspace } from "@/lib/session";
import { hasFeature } from "@/lib/features";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { ClickableRow } from "@/components/clickable-row";
import { Plus, Mic } from "lucide-react";
import type { Campus } from "@prisma/client";

const CAMPUS_LABELS: Record<Campus, string> = {
  MADRID: "Madrid",
  SEGOVIA: "Segovia",
  BOTH: "Both",
};

export default async function PodcastPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ campus?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { workspace } = await requireWorkspace();
  if (!hasFeature(workspace, "podcast")) notFound();

  const sp = await searchParams;
  const filter: "ALL" | Campus =
    sp.campus === "MADRID" || sp.campus === "SEGOVIA" || sp.campus === "BOTH"
      ? sp.campus
      : "ALL";

  const campusWhere =
    filter === "ALL"
      ? {}
      : filter === "BOTH"
        ? { campus: "BOTH" as Campus }
        : { campus: { in: [filter, "BOTH"] as Campus[] } };

  const episodes = await prisma.podcastEpisode.findMany({
    where: { workspaceId: workspace.id, archivedAt: null, ...campusWhere },
    orderBy: [{ recordingDate: "desc" }, { createdAt: "desc" }],
    take: 100,
  });

  const pills: { key: "ALL" | Campus; label: string }[] = [
    { key: "ALL", label: "All" },
    { key: "MADRID", label: "Madrid" },
    { key: "SEGOVIA", label: "Segovia" },
    { key: "BOTH", label: "Both" },
  ];

  return (
    <div className="mx-auto max-w-6xl px-8 py-8">
      <PageHeader
        title="Podcast"
        description={`${episodes.length} ${episodes.length === 1 ? "episode" : "episodes"}`}
        actions={
          <Link href="/podcast/new">
            <Button size="sm" className="gap-1.5">
              <Plus size={14} /> New episode
            </Button>
          </Link>
        }
      />

      <div className="mt-4 flex flex-wrap gap-1.5">
        {pills.map((p) => {
          const active = p.key === filter;
          const href = p.key === "ALL" ? "/podcast" : `/podcast?campus=${p.key}`;
          return (
            <Link
              key={p.key}
              href={href}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                active
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary/60 text-muted-foreground hover:bg-secondary"
              }`}
            >
              {p.label}
            </Link>
          );
        })}
      </div>

      {episodes.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-border bg-card p-12 text-center shadow-sm">
          <Mic size={28} className="mx-auto text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">
            No episodes yet. Plan a guest or recording date to get started.
          </p>
          <Link href="/podcast/new" className="mt-4 inline-block">
            <Button size="sm">Create the first episode</Button>
          </Link>
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-secondary/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">Title</th>
                <th className="px-4 py-3 text-left">Guest</th>
                <th className="px-4 py-3 text-left">Campus</th>
                <th className="px-4 py-3 text-left">Recorded</th>
                <th className="px-4 py-3 text-left">Published</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {episodes.map((e) => (
                <ClickableRow key={e.id} href={`/podcast/${e.id}`}>
                  <td className="px-4 py-3 font-medium">
                    <Link href={`/podcast/${e.id}`} className="hover:underline">
                      {e.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {e.guestName ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex rounded-full bg-secondary/60 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                      {CAMPUS_LABELS[e.campus]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground tabular-nums">
                    {e.recordingDate ? e.recordingDate.toISOString().slice(0, 10) : "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground tabular-nums">
                    {e.publishDate ? e.publishDate.toISOString().slice(0, 10) : "—"}
                  </td>
                </ClickableRow>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
