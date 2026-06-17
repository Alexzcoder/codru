import { prisma } from "@/lib/prisma";
import { requireWorkspace } from "@/lib/session";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { createBlankProtocol } from "./actions";
import { formatDateTimePrague } from "@/lib/format-datetime";

export default async function HandoverProtocolsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { workspace } = await requireWorkspace();
  const t = await getTranslations();

  const protocols = await prisma.handoverProtocol.findMany({
    where: { workspaceId: workspace.id },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const createBound = async () => {
    "use server";
    await createBlankProtocol();
  };

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("HandoverProtocols.title")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("HandoverProtocols.subtitle")}
          </p>
        </div>
        <form action={createBound}>
          <Button type="submit">{t("HandoverProtocols.newBlank")}</Button>
        </form>
      </div>

      <div className="mt-6 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        {protocols.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            {t("HandoverProtocols.empty")}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-secondary/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left">{t("HandoverProtocols.fields.created")}</th>
                <th className="px-4 py-2 text-left">{t("HandoverProtocols.fields.client")}</th>
                <th className="px-4 py-2 text-left">{t("HandoverProtocols.fields.zakazkaNumber")}</th>
                <th className="px-4 py-2 text-left">{t("HandoverProtocols.fields.status")}</th>
                <th className="px-4 py-2 text-left">{t("HandoverProtocols.fields.acceptance")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {protocols.map((p) => (
                <tr key={p.id} className="hover:bg-secondary/30">
                  <td className="px-4 py-2 whitespace-nowrap text-xs text-muted-foreground">
                    <Link href={`/handover-protocols/${p.id}`} className="hover:underline">
                      {formatDateTimePrague(p.createdAt)}
                    </Link>
                  </td>
                  <td className="px-4 py-2">
                    <Link href={`/handover-protocols/${p.id}`} className="hover:underline">
                      {p.clientName?.trim() || (
                        <span className="italic text-muted-foreground">
                          {t("HandoverProtocols.noClient")}
                        </span>
                      )}
                    </Link>
                  </td>
                  <td className="px-4 py-2 font-mono text-xs">
                    {p.zakazkaNumber ?? "—"}
                  </td>
                  <td className="px-4 py-2 text-xs">
                    {t(`HandoverProtocols.status.${p.status}`)}
                  </td>
                  <td className="px-4 py-2 text-xs">
                    {t(`HandoverProtocols.acceptanceLabel.${p.acceptance}`)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
