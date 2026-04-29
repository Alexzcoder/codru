import { setRequestLocale } from "next-intl/server";
import { requireWorkspace } from "@/lib/session";
import { hasFeature } from "@/lib/features";
import { notFound } from "next/navigation";
import { BackLink } from "@/components/back-link";
import { EventForm } from "../event-form";
import { createEvent } from "../actions";

export default async function NewEventPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { workspace } = await requireWorkspace();
  if (!hasFeature(workspace, "events")) notFound();

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <BackLink href="/events" label="Events" />
      <h1 className="text-2xl font-semibold tracking-tight">New event</h1>
      <div className="mt-8">
        <EventForm action={createEvent} submitLabel="Create event" />
      </div>
    </div>
  );
}
