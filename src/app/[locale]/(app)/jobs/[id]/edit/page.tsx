import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { clientDisplayName } from "@/lib/client-display";
import { JobForm } from "../../job-form";
import { updateJob } from "../../actions";
import { BackLink } from "@/components/back-link";

export default async function EditJobPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  await requireUser();
  const t = await getTranslations();

  const [job, clients, users] = await Promise.all([
    prisma.job.findUnique({
      where: { id },
      include: { assignments: true },
    }),
    prisma.client.findMany({
      where: { deletedAt: null, anonymizedAt: null },
      select: { id: true, type: true, companyName: true, fullName: true, anonymizedAt: true },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.user.findMany({
      where: { deactivatedAt: null },
      select: { id: true, name: true, calendarColor: true },
      orderBy: { name: "asc" },
    }),
  ]);
  if (!job) notFound();

  const bound = updateJob.bind(null, id);

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <BackLink href={`/jobs/${id}`} label={job.title} />
      <h1 className="text-2xl font-semibold tracking-tight">{job.title}</h1>
      <div className="mt-8">
        <JobForm
          initial={{ ...job, assigneeIds: job.assignments.map((a) => a.userId) }}
          clients={clients.map((c) => ({ id: c.id, name: clientDisplayName(c) }))}
          users={users}
          action={bound}
        />
      </div>
    </div>
  );
}
