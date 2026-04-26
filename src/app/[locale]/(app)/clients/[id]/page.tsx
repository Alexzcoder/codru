import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { clientDisplayName } from "@/lib/client-display";
import { calculateDocument } from "@/lib/line-items";
import { ContactLogForm } from "./contact-log-form";
import { deleteClient, anonymizeClient } from "../actions";
import { BackLink } from "@/components/back-link";
import { ConfirmButton } from "@/components/confirm-button";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  await requireUser();
  const t = await getTranslations();

  const [client, logs, customValues, customDefs, jobs, jobAttachments, docSnapshots, clientDocs] =
    await Promise.all([
      prisma.client.findUnique({ where: { id } }),
      prisma.contactLog.findMany({
        where: { clientId: id },
        orderBy: { date: "desc" },
        include: { loggedBy: { select: { name: true } } },
        take: 100,
      }),
      prisma.customFieldValue.findMany({
        where: { clientId: id },
        include: { fieldDef: true },
      }),
      prisma.customFieldDef.findMany({ where: { archivedAt: null } }),
      prisma.job.findMany({
        where: { clientId: id },
        orderBy: { updatedAt: "desc" },
        take: 50,
      }),
      prisma.attachment.findMany({
        where: { job: { clientId: id } },
        include: { job: { select: { id: true, title: true } } },
        orderBy: { createdAt: "desc" },
        take: 200,
      }),
      prisma.pdfSnapshot.findMany({
        where: { document: { clientId: id } },
        include: {
          document: { select: { id: true, type: true, number: true, issueDate: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 200,
      }),
      prisma.document.findMany({
        where: { clientId: id, deletedAt: null },
        include: {
          lineItems: true,
          paymentAllocations: true,
        },
        orderBy: { issueDate: "desc" },
        take: 200,
      }),
    ]);

  const calendarEvents = await prisma.calendarEvent.findMany({
    where: {
      OR: [{ clientId: id }, { job: { clientId: id } }],
    },
    orderBy: { startsAt: "asc" },
    take: 200,
  });
  const now = Date.now();
  const scheduleItems = [
    ...jobs
      .filter((j) => j.scheduledStart)
      .map((j) => ({
        id: j.id,
        kind: "job" as const,
        title: j.title,
        date: j.scheduledStart!,
        href: `/jobs/${j.id}`,
      })),
    ...calendarEvents.map((e) => ({
      id: e.id,
      kind: "event" as const,
      title: e.title,
      date: e.startsAt,
      href: `/calendar/${e.id}`,
    })),
  ].sort((a, b) => a.date.getTime() - b.date.getTime());
  const upcoming = scheduleItems.filter((i) => i.date.getTime() >= now);
  const past = scheduleItems.filter((i) => i.date.getTime() < now).reverse();
  if (!client || client.deletedAt) notFound();

  // ── Financial summary ──────────────────────────────────────────────────────
  // Sum gross from sent invoices (advance + final). Subtract credit notes.
  // totalPaid = sum of allocations on the same invoices.
  let totalBilled = 0;
  let totalPaid = 0;
  let totalCredited = 0;
  for (const d of clientDocs) {
    if (d.status === "UNSENT") continue;
    const totals = calculateDocument({
      lines: d.lineItems.map((l) => ({
        quantity: l.quantity.toString(),
        unitPrice: l.unitPrice.toString(),
        taxRatePercent: l.taxRatePercent.toString(),
        taxMode: l.taxMode,
        lineDiscountPercent: l.lineDiscountPercent?.toString() ?? null,
        lineDiscountAmount: l.lineDiscountAmount?.toString() ?? null,
      })),
      documentDiscountPercent: d.documentDiscountPercent?.toString() ?? null,
      documentDiscountAmount: d.documentDiscountAmount?.toString() ?? null,
      reverseCharge: d.reverseCharge,
    });
    const gross = Number.parseFloat(totals.totalGross);
    if (d.type === "FINAL_INVOICE" || d.type === "ADVANCE_INVOICE") {
      totalBilled += gross;
      for (const a of d.paymentAllocations) {
        totalPaid += Number(a.amount);
      }
    } else if (d.type === "CREDIT_NOTE") {
      totalCredited += gross;
    }
  }
  const outstanding = Math.max(totalBilled - totalCredited - totalPaid, 0);

  const deleteBound = async () => {
    "use server";
    await deleteClient(id);
  };
  const anonymizeBound = async () => {
    "use server";
    await anonymizeClient(id);
  };

  const address = [client.addressStreet, client.addressZip, client.addressCity]
    .filter(Boolean)
    .join(", ");

  const statusStyle: Record<string, string> = {
    POTENTIAL: "bg-amber-100 text-amber-800",
    ACTIVE: "bg-emerald-100 text-emerald-800",
    PAST: "bg-secondary text-secondary-foreground",
    FAILED: "bg-red-100 text-red-800",
  };

  return (
    <div className="mx-auto max-w-5xl px-8 py-8">
      <BackLink href="/clients" label={t("Clients.title")} />
      <div className="mb-8">
        <p className="mb-1 text-xs text-muted-foreground">
          {t(`Clients.type.${client.type}`)}
        </p>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <h1 className="text-[26px] font-semibold tracking-tight">
              {clientDisplayName(client)}
            </h1>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusStyle[client.status] ?? "bg-secondary"}`}
            >
              {t(`Clients.status.${client.status}`)}
            </span>
          </div>
          {!client.anonymizedAt && (
            <Link href={`/clients/${id}/edit`}>
              <Button variant="outline" size="sm">
                {t("Settings.edit")}
              </Button>
            </Link>
          )}
        </div>
        {client.anonymizedAt && (
          <p className="mt-1 text-xs text-muted-foreground">
            Anonymized {client.anonymizedAt.toISOString().slice(0, 10)}
          </p>
        )}
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-3">
        <section className="md:col-span-2 rounded-xl border border-border bg-card shadow-sm p-5">
          <h2 className="text-sm font-medium text-muted-foreground">Contact</h2>
          <dl className="mt-3 grid grid-cols-2 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Email</dt>
            <dd>{client.email ?? "—"}</dd>
            <dt className="text-muted-foreground">Phone</dt>
            <dd>{client.phone ?? "—"}</dd>
            <dt className="text-muted-foreground">IČO</dt>
            <dd>{client.ico ?? "—"}</dd>
            <dt className="text-muted-foreground">DIČ</dt>
            <dd>{client.dic ?? "—"}</dd>
            <dt className="text-muted-foreground">Address</dt>
            <dd>{address || "—"}</dd>
            <dt className="text-muted-foreground">Language</dt>
            <dd>{client.defaultLanguage.toUpperCase()}</dd>
            <dt className="text-muted-foreground">Currency</dt>
            <dd>{client.preferredCurrency}</dd>
          </dl>
          {client.notes && (
            <>
              <h3 className="mt-6 text-sm font-medium text-muted-foreground">Notes</h3>
              <p className="mt-2 whitespace-pre-wrap text-sm">{client.notes}</p>
            </>
          )}
          {customDefs.length > 0 && customValues.length > 0 && (
            <>
              <h3 className="mt-6 text-sm font-medium text-muted-foreground">
                {t("Clients.detail.customFields")}
              </h3>
              <dl className="mt-2 grid grid-cols-2 gap-y-1 text-sm">
                {customValues.map((v) => (
                  <div key={v.id} className="contents">
                    <dt className="text-muted-foreground">{v.fieldDef.label}</dt>
                    <dd>{v.value}</dd>
                  </div>
                ))}
              </dl>
            </>
          )}
        </section>

        <aside className="rounded-xl border border-border bg-card shadow-sm p-5">
          <h2 className="text-sm font-medium text-muted-foreground">
            {t("Clients.detail.financials")}
          </h2>
          <dl className="mt-3 grid grid-cols-2 gap-y-2 text-sm">
            <dt className="text-muted-foreground">{t("Clients.detail.totalBilled")}</dt>
            <dd className="text-right tabular-nums">{totalBilled.toFixed(2)} {client.preferredCurrency}</dd>
            <dt className="text-muted-foreground">{t("Clients.detail.totalPaid")}</dt>
            <dd className="text-right tabular-nums">{totalPaid.toFixed(2)} {client.preferredCurrency}</dd>
            {totalCredited > 0 && (
              <>
                <dt className="text-muted-foreground">Credit notes</dt>
                <dd className="text-right tabular-nums">−{totalCredited.toFixed(2)} {client.preferredCurrency}</dd>
              </>
            )}
            <dt className="text-muted-foreground font-medium">{t("Clients.detail.outstanding")}</dt>
            <dd className={`text-right tabular-nums font-semibold ${outstanding > 0 ? "text-amber-700" : "text-foreground"}`}>
              {outstanding.toFixed(2)} {client.preferredCurrency}
            </dd>
          </dl>
        </aside>
      </div>

      <section className="mt-10">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">Documents</h2>
          <Link href={`/quotes/new?clientId=${id}`}>
            <Button size="sm" variant="outline">
              {t("Quotes.newQuote")}
            </Button>
          </Link>
        </div>
        {clientDocs.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No documents yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border rounded-xl border border-border bg-card shadow-sm">
            {clientDocs.map((d) => {
              const href =
                d.type === "QUOTE"
                  ? `/quotes/${d.id}`
                  : d.type === "ADVANCE_INVOICE"
                  ? `/advance-invoices/${d.id}`
                  : d.type === "FINAL_INVOICE"
                  ? `/final-invoices/${d.id}`
                  : `/credit-notes/${d.id}`;
              const typeLabel =
                d.type === "QUOTE"
                  ? t("Quotes.title")
                  : d.type === "ADVANCE_INVOICE"
                  ? t("AdvanceInvoices.title")
                  : d.type === "FINAL_INVOICE"
                  ? t("FinalInvoices.title")
                  : t("CreditNotes.title");
              return (
                <li key={d.id}>
                  <Link
                    href={href}
                    className="flex items-center justify-between gap-3 px-4 py-2 text-sm hover:bg-secondary/40"
                  >
                    <span className="flex items-center gap-3 min-w-0">
                      <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground shrink-0">
                        {typeLabel}
                      </span>
                      <span className="font-medium truncate">
                        {d.number ?? d.title ?? t("Common.draft")}
                      </span>
                    </span>
                    <span className="flex items-center gap-3 text-xs text-muted-foreground shrink-0">
                      <span>{d.issueDate.toISOString().slice(0, 10)}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="mt-10">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">{t("Clients.detail.jobs")}</h2>
          <Link href={`/jobs/new?clientId=${id}`}>
            <Button size="sm" variant="outline">
              {t("Jobs.newJob")}
            </Button>
          </Link>
        </div>
        {jobs.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No jobs yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border rounded-xl border border-border bg-card shadow-sm">
            {jobs.map((j) => (
              <li key={j.id}>
                <Link
                  href={`/jobs/${j.id}`}
                  className="flex items-center justify-between px-4 py-2 text-sm hover:bg-secondary/40"
                >
                  <span className="font-medium">{j.title}</span>
                  <span className="flex items-center gap-3 text-xs text-muted-foreground">
                    {j.scheduledStart
                      ? j.scheduledStart.toISOString().slice(0, 10)
                      : ""}
                    <span>{t(`Jobs.status.${j.status}`)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-medium">Schedule</h2>
        {upcoming.length === 0 && past.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Nothing scheduled. Add a job or calendar event for this client.
          </p>
        ) : (
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-border bg-card shadow-sm p-4">
              <h3 className="text-xs uppercase tracking-wider text-muted-foreground">
                Upcoming ({upcoming.length})
              </h3>
              {upcoming.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">No upcoming items.</p>
              ) : (
                <ul className="mt-2 divide-y divide-border">
                  {upcoming.slice(0, 12).map((i) => (
                    <li key={`${i.kind}-${i.id}`} className="flex items-start justify-between gap-3 py-2 text-sm">
                      <Link href={i.href} className="truncate hover:underline">
                        {i.title}
                      </Link>
                      <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                        {i.date.toISOString().slice(0, 10)} · {i.date.toISOString().slice(11, 16)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="rounded-xl border border-border bg-card shadow-sm p-4">
              <h3 className="text-xs uppercase tracking-wider text-muted-foreground">
                History ({past.length})
              </h3>
              {past.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">No past items.</p>
              ) : (
                <ul className="mt-2 divide-y divide-border">
                  {past.slice(0, 12).map((i) => (
                    <li key={`${i.kind}-${i.id}`} className="flex items-start justify-between gap-3 py-2 text-sm">
                      <Link href={i.href} className="truncate text-muted-foreground hover:underline">
                        {i.title}
                      </Link>
                      <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                        {i.date.toISOString().slice(0, 10)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-medium">Files</h2>
        {jobAttachments.length === 0 && docSnapshots.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No files yet — attach photos or PDFs to a job.</p>
        ) : (
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-border bg-card shadow-sm p-4">
              <h3 className="text-xs uppercase tracking-wider text-muted-foreground">
                Job attachments ({jobAttachments.length})
              </h3>
              {jobAttachments.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">—</p>
              ) : (
                <ul className="mt-2 divide-y divide-border">
                  {jobAttachments.map((a) => (
                    <li key={a.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                      <a href={a.path} target="_blank" rel="noreferrer" className="truncate hover:underline">
                        {a.filename}
                      </a>
                      <Link
                        href={`/jobs/${a.job.id}`}
                        className="shrink-0 text-xs text-muted-foreground hover:underline"
                      >
                        {a.job.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="rounded-xl border border-border bg-card shadow-sm p-4">
              <h3 className="text-xs uppercase tracking-wider text-muted-foreground">
                Document PDFs ({docSnapshots.length})
              </h3>
              {docSnapshots.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">—</p>
              ) : (
                <ul className="mt-2 divide-y divide-border">
                  {docSnapshots.map((s) => (
                    <li key={s.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                      <a href={s.filePath} target="_blank" rel="noreferrer" className="truncate hover:underline">
                        {s.document.number ?? s.document.type}
                      </a>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {s.document.issueDate.toISOString().slice(0, 10)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-medium">{t("Clients.detail.contactLog")}</h2>
        <div className="mt-3">
          <ContactLogForm clientId={id} />
        </div>

        {logs.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">No contact logs yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-border rounded-xl border border-border bg-card shadow-sm">
            {logs.map((l) => (
              <li key={l.id} className="px-4 py-3">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
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

      {!client.anonymizedAt && (
        <div className="mt-12 rounded-md border border-red-200 bg-red-50 p-5">
          <h3 className="text-sm font-medium text-red-900">Danger zone</h3>
          <p className="mt-1 text-xs text-red-800">
            {t("Clients.anonymizeExplain")}
          </p>
          <div className="mt-3 flex gap-2">
            <form action={deleteBound}>
              <ConfirmButton
                label={t("Clients.delete")}
                message="The client and all their data will be soft-deleted."
              />
            </form>
            <form action={anonymizeBound}>
              <ConfirmButton
                label={t("Clients.anonymize")}
                message="Personal data will be redacted. Documents remain for legal retention."
              />
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
