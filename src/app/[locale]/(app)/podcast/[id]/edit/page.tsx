import { setRequestLocale } from "next-intl/server";
import { requireWorkspace } from "@/lib/session";
import { hasFeature } from "@/lib/features";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { BackLink } from "@/components/back-link";
import { EpisodeForm } from "../../episode-form";
import { updateEpisode } from "../../actions";

export default async function EditEpisodePage({
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

  const bound = updateEpisode.bind(null, id);

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <BackLink href={`/podcast/${id}`} label={ep.title} />
      <h1 className="text-2xl font-semibold tracking-tight">Edit episode</h1>
      <div className="mt-8">
        <EpisodeForm initial={ep} action={bound} submitLabel="Save" />
      </div>
    </div>
  );
}
