import { setRequestLocale } from "next-intl/server";
import { requireWorkspace } from "@/lib/session";
import { hasFeature } from "@/lib/features";
import { notFound } from "next/navigation";
import { BackLink } from "@/components/back-link";
import { EpisodeForm } from "../episode-form";
import { createEpisode } from "../actions";

export default async function NewEpisodePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { workspace } = await requireWorkspace();
  if (!hasFeature(workspace, "podcast")) notFound();

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <BackLink href="/podcast" label="Podcast" />
      <h1 className="text-2xl font-semibold tracking-tight">New episode</h1>
      <div className="mt-8">
        <EpisodeForm action={createEpisode} submitLabel="Create episode" />
      </div>
    </div>
  );
}
