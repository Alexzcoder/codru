import { prisma } from "@/lib/prisma";
import { requireWorkspace } from "@/lib/session";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { BackLink } from "@/components/back-link";
import { ConfirmButton } from "@/components/confirm-button";
import { deleteProtocol } from "../actions";
import {
  ProtocolForm,
  type ProtocolFormValues,
} from "../protocol-form";

function isoToInputDate(d: Date | null): string {
  if (!d) return "";
  return d.toISOString().slice(0, 10);
}

export default async function ProtocolDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const { workspace } = await requireWorkspace();
  const t = await getTranslations();

  const protocol = await prisma.handoverProtocol.findFirst({
    where: { id, workspaceId: workspace.id },
    include: {
      items: { orderBy: { position: "asc" } },
      sourceQuote: { select: { id: true, number: true, title: true } },
      client: true,
      job: true,
    },
  });
  if (!protocol) notFound();

  const initial: ProtocolFormValues = {
    number: protocol.number ?? "",
    clientName: protocol.clientName ?? "",
    clientPhone: protocol.clientPhone ?? "",
    clientEmail: protocol.clientEmail ?? "",
    siteAddress: protocol.siteAddress ?? "",
    zakazkaNumber: protocol.zakazkaNumber ?? "",
    contractorName: protocol.contractorName ?? "",
    leaderName: protocol.leaderName ?? "",
    realizationDate: isoToInputDate(protocol.realizationDate),
    signedAt: isoToInputDate(protocol.signedAt),
    vicepraceDone: protocol.vicepraceDone,
    vicepraceDescription: protocol.vicepraceDescription ?? "",
    vicepracePrice: protocol.vicepracePrice ?? "",
    vicepraceConsent: protocol.vicepraceConsent ?? "",
    usedMaterials: protocol.usedMaterials ?? "",
    wasteGenerated: protocol.wasteGenerated ?? "",
    wasteRemoved: protocol.wasteRemoved ?? "",
    photosBeforeTaken: protocol.photosBeforeTaken,
    photosDuringTaken: protocol.photosDuringTaken,
    photosAfterTaken: protocol.photosAfterTaken,
    acceptance: protocol.acceptance,
    clientReservations: protocol.clientReservations ?? "",
    contractorNote: protocol.contractorNote ?? "",
    status: protocol.status,
    items: protocol.items.map((it) => ({
      name: it.name,
      description: it.description ?? "",
      quantity: it.quantity ?? "",
      unit: it.unit ?? "",
      completed: it.completed,
      notCompleted: it.notCompleted,
      note: it.note ?? "",
    })),
  };

  const deleteBound = async () => {
    "use server";
    await deleteProtocol(id);
  };

  const title = protocol.clientName?.trim() || t("HandoverProtocols.draftTitle");

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <BackLink href="/handover-protocols" label={t("HandoverProtocols.title")} />
      <div className="mt-1 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {protocol.sourceQuote && (
            <p className="mt-1 text-xs text-muted-foreground">
              {t("HandoverProtocols.fromQuote")}:{" "}
              <Link
                href={`/quotes/${protocol.sourceQuote.id}`}
                className="hover:underline"
              >
                {protocol.sourceQuote.title ??
                  protocol.sourceQuote.number ??
                  protocol.sourceQuote.id.slice(0, 8)}
              </Link>
            </p>
          )}
        </div>
        <form action={deleteBound}>
          <ConfirmButton
            label={t("HandoverProtocols.delete")}
            message={t("HandoverProtocols.deleteConfirm")}
          />
        </form>
      </div>

      <div className="mt-6">
        <ProtocolForm
          protocolId={id}
          initial={initial}
          printHref={`/${locale}/handover-protocols/${id}/print`}
        />
      </div>
    </div>
  );
}
