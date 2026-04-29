import { setRequestLocale } from "next-intl/server";
import { requireWorkspace } from "@/lib/session";
import { hasFeature } from "@/lib/features";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { BackLink } from "@/components/back-link";
import { EventForm } from "../../event-form";
import { updateEvent } from "../../actions";

export default async function EditEventPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const { workspace } = await requireWorkspace();
  if (!hasFeature(workspace, "events")) notFound();

  const ev = await prisma.event.findFirst({
    where: { id, workspaceId: workspace.id },
  });
  if (!ev) notFound();

  const bound = updateEvent.bind(null, id);

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <BackLink href={`/events/${id}`} label={ev.name} />
      <h1 className="text-2xl font-semibold tracking-tight">Edit event</h1>
      <div className="mt-8">
        <EventForm initial={ev} action={bound} submitLabel="Save" />
      </div>
    </div>
  );
}
