import { setRequestLocale } from "next-intl/server";
import { requireWorkspace } from "@/lib/session";
import { hasFeature } from "@/lib/features";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { SchedulerForm } from "./scheduler-form";

export default async function SchedulerPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { workspace } = await requireWorkspace();
  if (!hasFeature(workspace, "scheduler")) notFound();

  return (
    <div className="mx-auto max-w-5xl px-8 py-8">
      <PageHeader
        title="Scheduler"
        description="Drop a speaker's availability — get the 3 slots most likely to fill the room."
      />
      <div className="mt-6">
        <SchedulerForm />
      </div>
    </div>
  );
}
