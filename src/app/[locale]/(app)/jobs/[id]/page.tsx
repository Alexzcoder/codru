import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { clientDisplayName } from "@/lib/client-display";
import { setJobStatus, deleteJob, deleteAttachment } from "../actions";
import { AttachmentUploader } from "./attachment-uploader";
import { ContactLogForm } from "../../clients/[id]/contact-log-form";

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  await requireUser();
  const t = await getTranslations();

  const [job, logs] = await Promise.all([
    prisma.job.findUnique({
      where: { id },
      include: {
        client: true,
        assignments: { include: { user: { select: { name: true, calendarColor: true } } } },
        attachments: {
          include: { uploadedBy: { select: { name: true } } },
          orderBy: { createdAt: "desc" },
        },
      },
    }),
    prisma.contactLog.findMany({
      where: { jobId: id },
      orderBy: { date: "desc" },
      include: { loggedBy: { select: { name: true } } },
      take: 100,
    }),
  ]);
  if (!job) notFound();

  const site =
    [job.siteStreet, job.siteZip, job.siteCity].filter(Boolean).join(", ") || null;
  const clientAddress =
    [job.client.addressStreet, job.client.addressZip, job.client.addressCity]
      .filter(Boolean)
      .join(", ") || "—";
  const deleteBound = async () => {
    "use server";
    await deleteJob(id);
  };

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-neutral-500">
            <Link href={`/clients/${job.client.id}`} className="hover:underline">
              {clientDisplayName(job.client)}
            </Link>{" "}
            · {t(`Jobs.status.${job.status}`)}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">{job.title}</h1>
        </div>
        <div className="flex gap-2">
          <Link href={`/jobs/${id}/edit`}>
            <Button variant="outline" size="sm">
              {t("Settings.edit")}
            </Button>
          </Link>
          <Link href={`/final-invoices/new?fromJob=${id}`}>
            <Button variant="outline" size="sm">
              → {t("FinalInvoices.new")}
            </Button>
          </Link>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <span className="text-xs text-neutral-500">Status:</span>
        {(["SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED"] as const).map((s) => {
          const bound = async () => {
            "use server";
            await setJobStatus(id, s);
          };
          const active = job.status === s;
          return (
            <form key={s} action={bound}>
              <Button
                type="submit"
                size="sm"
                variant={active ? "default" : "outline"}
              >
                {t(`Jobs.status.${s}`)}
              </Button>
            </form>
          );
        })}
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-3">
        <section className="md:col-span-2 rounded-md border border-neutral-200 bg-white p-5">
          <dl className="grid grid-cols-[140px_1fr] gap-y-2 text-sm">
            <dt className="text-neutral-500">Client</dt>
            <dd>
              <Link
                href={`/clients/${job.client.id}`}
                className="font-medium hover:underline"
              >
                {clientDisplayName(job.client)}
              </Link>
            </dd>
            <dt className="text-neutral-500">{t("Jobs.form.start")}</dt>
            <dd>
              {job.scheduledStart
                ? job.scheduledStart.toISOString().slice(0, 16).replace("T", " ")
                : "—"}
            </dd>
            <dt className="text-neutral-500">{t("Jobs.form.end")}</dt>
            <dd>
              {job.scheduledEnd
                ? job.scheduledEnd.toISOString().slice(0, 16).replace("T", " ")
                : "—"}
            </dd>
            <dt className="text-neutral-500">{t("Jobs.detail.siteAddress")}</dt>
            <dd>
              {site ?? (
                <span className="text-neutral-500">
                  {t("Jobs.detail.usesClientAddress")} — {clientAddress}
                </span>
              )}
            </dd>
            <dt className="text-neutral-500">{t("Jobs.form.assignees")}</dt>
            <dd>
              {job.assignments.length === 0 ? (
                "—"
              ) : (
                <div className="flex flex-wrap gap-2">
                  {job.assignments.map((a) => (
                    <span
                      key={a.userId}
                      className="inline-flex items-center gap-1.5 rounded-full bg-neutral-100 px-2 py-0.5 text-xs"
                    >
                      <span
                        className="inline-block h-2 w-2 rounded-full"
                        style={{ background: a.user.calendarColor }}
                      />
                      {a.user.name}
                    </span>
                  ))}
                </div>
              )}
            </dd>
          </dl>
          {job.notes && (
            <>
              <h3 className="mt-6 text-sm font-medium text-neutral-500">Notes</h3>
              <p className="mt-2 whitespace-pre-wrap text-sm">{job.notes}</p>
            </>
          )}
        </section>

        <aside className="rounded-md border border-neutral-200 bg-white p-5">
          <h2 className="text-sm font-medium text-neutral-500">
            {t("Jobs.detail.documents")}
          </h2>
          <p className="mt-3 text-xs text-neutral-400">{t("Jobs.detail.noDocs")}</p>
        </aside>
      </div>

      <section className="mt-10">
        <h2 className="text-lg font-medium">{t("Jobs.detail.attachments")}</h2>
        <p className="mt-1 text-xs text-neutral-500">{t("Jobs.detail.uploadLimits")}</p>
        <div className="mt-3">
          <AttachmentUploader jobId={id} />
        </div>

        {job.attachments.length === 0 ? (
          <p className="mt-4 text-sm text-neutral-500">No attachments yet.</p>
        ) : (
          <ul className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            {job.attachments.map((a) => {
              const delBound = async () => {
                "use server";
                await deleteAttachment(a.id);
              };
              return (
                <li
                  key={a.id}
                  className="overflow-hidden rounded-md border border-neutral-200 bg-white"
                >
                  {a.kind === "IMAGE" ? (
                    <a href={a.path} target="_blank" rel="noreferrer">
                      <img
                        src={a.path}
                        alt={a.filename}
                        className="h-32 w-full object-cover"
                      />
                    </a>
                  ) : a.kind === "PDF" ? (
                    <a
                      href={a.path}
                      target="_blank"
                      rel="noreferrer"
                      className="flex h-32 items-center justify-center bg-neutral-50 text-sm text-neutral-700"
                    >
                      📄 PDF
                    </a>
                  ) : (
                    <div className="flex h-32 items-center justify-center bg-neutral-50 text-sm text-neutral-500">
                      file
                    </div>
                  )}
                  <div className="p-2 text-xs">
                    <p className="truncate font-medium" title={a.filename}>
                      {a.filename}
                    </p>
                    <p className="text-neutral-500">
                      {formatBytes(a.sizeBytes)} · {a.uploadedBy.name}
                    </p>
                    {a.caption && (
                      <p className="mt-1 text-neutral-600">{a.caption}</p>
                    )}
                    <form action={delBound} className="mt-2">
                      <button
                        type="submit"
                        className="text-xs text-red-600 hover:underline"
                      >
                        {t("Jobs.detail.deleteAttachment")}
                      </button>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-medium">{t("Jobs.detail.contactLog")}</h2>
        <div className="mt-3">
          <ContactLogForm clientId={job.client.id} jobId={id} />
        </div>
        {logs.length === 0 ? (
          <p className="mt-4 text-sm text-neutral-500">No contact logs for this job yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-neutral-200 rounded-md border border-neutral-200 bg-white">
            {logs.map((l) => (
              <li key={l.id} className="px-4 py-3">
                <div className="flex items-center justify-between text-xs text-neutral-500">
                  <span>
                    {t(`Clients.contactType.${l.type}`)} · {l.loggedBy.name}
                  </span>
                  <time>{l.date.toISOString().slice(0, 16).replace("T", " ")}</time>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm">{l.notes}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="mt-12 rounded-md border border-red-200 bg-red-50 p-5">
        <h3 className="text-sm font-medium text-red-900">Danger zone</h3>
        <form action={deleteBound} className="mt-3">
          <Button type="submit" variant="outline" size="sm">
            Delete job
          </Button>
        </form>
      </div>
    </div>
  );
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
