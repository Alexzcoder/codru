import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { clientDisplayName } from "@/lib/client-display";
import { ContactLogForm } from "./contact-log-form";
import { deleteClient, anonymizeClient } from "../actions";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  await requireUser();
  const t = await getTranslations();

  const [client, logs, customValues, customDefs] = await Promise.all([
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
  ]);
  if (!client || client.deletedAt) notFound();

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

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-neutral-500">
            {t(`Clients.type.${client.type}`)} · {t(`Clients.status.${client.status}`)}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">
            {clientDisplayName(client)}
          </h1>
          {client.anonymizedAt && (
            <p className="mt-1 text-xs text-neutral-500">
              Anonymized {client.anonymizedAt.toISOString().slice(0, 10)}
            </p>
          )}
        </div>
        {!client.anonymizedAt && (
          <div className="flex gap-2">
            <Link href={`/clients/${id}/edit`}>
              <Button variant="outline" size="sm">
                {t("Settings.edit")}
              </Button>
            </Link>
          </div>
        )}
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-3">
        <section className="md:col-span-2 rounded-md border border-neutral-200 bg-white p-5">
          <h2 className="text-sm font-medium text-neutral-500">Contact</h2>
          <dl className="mt-3 grid grid-cols-2 gap-y-2 text-sm">
            <dt className="text-neutral-500">Email</dt>
            <dd>{client.email ?? "—"}</dd>
            <dt className="text-neutral-500">Phone</dt>
            <dd>{client.phone ?? "—"}</dd>
            <dt className="text-neutral-500">IČO</dt>
            <dd>{client.ico ?? "—"}</dd>
            <dt className="text-neutral-500">DIČ</dt>
            <dd>{client.dic ?? "—"}</dd>
            <dt className="text-neutral-500">Address</dt>
            <dd>{address || "—"}</dd>
            <dt className="text-neutral-500">Language</dt>
            <dd>{client.defaultLanguage.toUpperCase()}</dd>
            <dt className="text-neutral-500">Currency</dt>
            <dd>{client.preferredCurrency}</dd>
          </dl>
          {client.notes && (
            <>
              <h3 className="mt-6 text-sm font-medium text-neutral-500">Notes</h3>
              <p className="mt-2 whitespace-pre-wrap text-sm">{client.notes}</p>
            </>
          )}
          {customDefs.length > 0 && customValues.length > 0 && (
            <>
              <h3 className="mt-6 text-sm font-medium text-neutral-500">
                {t("Clients.detail.customFields")}
              </h3>
              <dl className="mt-2 grid grid-cols-2 gap-y-1 text-sm">
                {customValues.map((v) => (
                  <div key={v.id} className="contents">
                    <dt className="text-neutral-500">{v.fieldDef.label}</dt>
                    <dd>{v.value}</dd>
                  </div>
                ))}
              </dl>
            </>
          )}
        </section>

        <aside className="rounded-md border border-neutral-200 bg-white p-5">
          <h2 className="text-sm font-medium text-neutral-500">
            {t("Clients.detail.financials")}
          </h2>
          <dl className="mt-3 grid grid-cols-2 gap-y-2 text-sm">
            <dt className="text-neutral-500">{t("Clients.detail.totalBilled")}</dt>
            <dd className="text-right tabular-nums">—</dd>
            <dt className="text-neutral-500">{t("Clients.detail.totalPaid")}</dt>
            <dd className="text-right tabular-nums">—</dd>
            <dt className="text-neutral-500">{t("Clients.detail.outstanding")}</dt>
            <dd className="text-right tabular-nums">—</dd>
          </dl>
          <p className="mt-3 text-xs text-neutral-400">Available from M10.</p>
        </aside>
      </div>

      <section className="mt-10 rounded-md border border-neutral-200 bg-white p-5">
        <h2 className="text-sm font-medium text-neutral-500">
          {t("Clients.detail.jobs")}
        </h2>
        <p className="mt-3 text-xs text-neutral-400">Available from M4.</p>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-medium">{t("Clients.detail.contactLog")}</h2>
        <div className="mt-3">
          <ContactLogForm clientId={id} />
        </div>

        {logs.length === 0 ? (
          <p className="mt-4 text-sm text-neutral-500">No contact logs yet.</p>
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

      {!client.anonymizedAt && (
        <div className="mt-12 rounded-md border border-red-200 bg-red-50 p-5">
          <h3 className="text-sm font-medium text-red-900">Danger zone</h3>
          <p className="mt-1 text-xs text-red-800">
            {t("Clients.anonymizeExplain")}
          </p>
          <div className="mt-3 flex gap-2">
            <form action={deleteBound}>
              <Button type="submit" variant="outline" size="sm">
                {t("Clients.delete")}
              </Button>
            </form>
            <form action={anonymizeBound}>
              <Button type="submit" variant="outline" size="sm">
                {t("Clients.anonymize")}
              </Button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
