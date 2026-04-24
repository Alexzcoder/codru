import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { clientDisplayName } from "@/lib/client-display";
import { ClientListFilters } from "./list-filters";
import type { ClientStatus } from "@prisma/client";

const PAGE_SIZE = 50;
const VALID_STATUSES: ClientStatus[] = ["POTENTIAL", "ACTIVE", "PAST", "FAILED"];

export default async function ClientsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireUser();
  const t = await getTranslations();
  const sp = await searchParams;

  const q = sp.q?.trim() ?? "";
  const statusFilter = VALID_STATUSES.includes(sp.status as ClientStatus)
    ? (sp.status as ClientStatus)
    : undefined;
  const page = Math.max(1, Number(sp.page) || 1);

  const where = {
    deletedAt: null,
    ...(statusFilter && { status: statusFilter }),
    ...(q && {
      OR: [
        { companyName: { contains: q, mode: "insensitive" as const } },
        { fullName: { contains: q, mode: "insensitive" as const } },
        { email: { contains: q, mode: "insensitive" as const } },
        { ico: { contains: q } },
      ],
    }),
  };

  const [clients, total] = await Promise.all([
    prisma.client.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.client.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">{t("Clients.title")}</h1>
        <div className="flex gap-2">
          <Link href="/clients/export" prefetch={false}>
            <Button variant="outline" size="sm">
              {t("Clients.exportCsv")}
            </Button>
          </Link>
          <Link href="/clients/new">
            <Button size="sm">{t("Clients.newClient")}</Button>
          </Link>
        </div>
      </div>

      <div className="mt-6">
        <ClientListFilters initialQ={q} initialStatus={statusFilter ?? "ALL"} />
      </div>

      {clients.length === 0 ? (
        <div className="mt-12 rounded-md border border-dashed border-neutral-300 bg-white p-12 text-center">
          <p className="text-sm text-neutral-600">{t("Clients.empty")}</p>
          <Link href="/clients/new" className="mt-4 inline-block">
            <Button size="sm">{t("Clients.emptyCTA")}</Button>
          </Link>
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-md border border-neutral-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-xs uppercase tracking-wider text-neutral-500">
              <tr>
                <th className="px-4 py-2 text-left">{t("Clients.form.type")}</th>
                <th className="px-4 py-2 text-left">Name</th>
                <th className="px-4 py-2 text-left">IČO</th>
                <th className="px-4 py-2 text-left">Email</th>
                <th className="px-4 py-2 text-left">{t("Clients.form.status")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {clients.map((c) => (
                <tr key={c.id} className="hover:bg-neutral-50">
                  <td className="px-4 py-2 text-neutral-500 text-xs">
                    {t(`Clients.type.${c.type}`)}
                  </td>
                  <td className="px-4 py-2">
                    <Link
                      href={`/clients/${c.id}`}
                      className="font-medium text-neutral-900 hover:underline"
                    >
                      {clientDisplayName(c)}
                    </Link>
                  </td>
                  <td className="px-4 py-2 tabular-nums text-neutral-600">{c.ico ?? ""}</td>
                  <td className="px-4 py-2 text-neutral-600">{c.email ?? ""}</td>
                  <td className="px-4 py-2">
                    <StatusBadge status={c.status} label={t(`Clients.status.${c.status}`)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm">
          <p className="text-neutral-500">
            {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
          </p>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={{
                  pathname: "/clients",
                  query: { ...(q && { q }), ...(statusFilter && { status: statusFilter }), page: page - 1 },
                }}
              >
                <Button variant="outline" size="sm">
                  Prev
                </Button>
              </Link>
            )}
            {page < totalPages && (
              <Link
                href={{
                  pathname: "/clients",
                  query: { ...(q && { q }), ...(statusFilter && { status: statusFilter }), page: page + 1 },
                }}
              >
                <Button variant="outline" size="sm">
                  Next
                </Button>
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status, label }: { status: ClientStatus; label: string }) {
  const cls = {
    POTENTIAL: "bg-amber-100 text-amber-800",
    ACTIVE: "bg-green-100 text-green-800",
    PAST: "bg-neutral-200 text-neutral-700",
    FAILED: "bg-red-100 text-red-800",
  }[status];
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs ${cls}`}>{label}</span>
  );
}
