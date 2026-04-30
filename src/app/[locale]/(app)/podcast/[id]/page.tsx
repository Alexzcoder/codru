import { setRequestLocale } from "next-intl/server";
import { requireWorkspace } from "@/lib/session";
import { hasFeature } from "@/lib/features";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { BackLink } from "@/components/back-link";
import { ConfirmButton } from "@/components/confirm-button";
import { deleteEpisode } from "../actions";

export default async function EpisodeDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const { workspace } = await requireWorkspace();
  if (!hasFeature(workspace, "podcast")) notFound();

  const ep = await prisma.podcastEpisode.findFirst({
    where: { id, workspaceId: workspace.id },
  });
  if (!ep) notFound();

  const deleteBound = async () => {
    "use server";
    await deleteEpisode(id);
  };

  const campusLabel =
    ep.campus === "BOTH" ? "Both campuses" : ep.campus === "MADRID" ? "Madrid" : "Segovia";

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <BackLink href="/podcast" label="Podcast" />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{ep.title}</h1>
            <span className="inline-flex rounded-full bg-secondary/60 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
              {campusLabel}
            </span>
          </div>
          {ep.guestName && (
            <p className="mt-1 text-sm text-muted-foreground">
              with {ep.guestName}
            </p>
          )}
          <p className="mt-1 text-xs text-muted-foreground tabular-nums">
            {ep.recordingDate ? `Recorded ${ep.recordingDate.toISOString().slice(0, 10)}` : "Recording date TBD"}
            {ep.publishDate ? ` · Published ${ep.publishDate.toISOString().slice(0, 10)}` : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href={`/podcast/${id}/edit`}>
            <Button variant="outline" size="sm">
              Edit
            </Button>
          </Link>
          <form action={deleteBound}>
            <ConfirmButton
              label="Delete"
              message="The episode will be removed from the podcast list."
            />
          </form>
        </div>
      </div>

      {ep.audioUrl && (
        <section className="mt-6 rounded-xl border border-border bg-card p-4 shadow-sm">
          <h2 className="text-sm font-medium text-muted-foreground">Audio</h2>
          <audio controls src={ep.audioUrl} className="mt-2 w-full">
            Your browser does not support the audio element.
          </audio>
          <a
            href={ep.audioUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-block text-xs text-muted-foreground hover:underline"
          >
            Open in new tab ↗
          </a>
        </section>
      )}

      {ep.showNotes && (
        <section className="mt-6 rounded-xl border border-border bg-card p-5 shadow-sm">
          <h2 className="text-sm font-medium text-muted-foreground">Show notes</h2>
          <p className="mt-2 whitespace-pre-wrap text-sm">{ep.showNotes}</p>
        </section>
      )}
    </div>
  );
}
