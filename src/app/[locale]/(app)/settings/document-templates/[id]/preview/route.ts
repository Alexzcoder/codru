import path from "node:path";
import { prisma } from "@/lib/prisma";
import { requireWorkspace } from "@/lib/session";
import { renderToBuffer } from "@react-pdf/renderer";
import { DocumentPdf } from "@/lib/pdf/document-pdf";
import { buildSampleData } from "@/lib/pdf/sample-data";
import { buildQrPlatbaDataUrl } from "@/lib/pdf/qr-platba";
import type { PdfLocale } from "@/lib/pdf/labels";
import { notFound } from "next/navigation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string; locale: string }> },
) {
  const { user, workspace } = await requireWorkspace();
  const { id } = await params;
  const url = new URL(req.url);
  const pdfLocale: PdfLocale =
    url.searchParams.get("lang") === "en" ? "en" : "cs";

  const template = await prisma.documentTemplate.findFirst({
    where: { id, companyProfile: { workspaceId: workspace.id } },
    include: { companyProfile: true },
  });
  if (!template || template.archivedAt) notFound();

  const sample = buildSampleData(template.type, {
    locale: pdfLocale,
    company: template.companyProfile,
    signaturePath: user.signatureImagePath,
    issuedByName: user.name,
  });

  const qr = template.showQrPlatba && sample.company.iban
    ? await buildQrPlatbaDataUrl({
        iban: sample.company.iban,
        amount: "48020.00", // sample amount; real docs pass totals.totalGross
        currency: sample.currency,
        variableSymbol: sample.variableSymbol ?? undefined,
        message: sample.number,
      })
    : null;

  const buffer = await renderToBuffer(
    DocumentPdf({
      data: sample,
      options: {
        accentColor: template.accentColor,
        showLogo: template.showLogo,
        showSignature: template.showSignature,
        showQrPlatba: template.showQrPlatba,
        showReverseChargeNote: template.showReverseChargeNote,
        customHeaderText: template.customHeaderText,
        customFooterText: template.customFooterText,
        letterheadAbsolutePath:
          template.letterheadImagePath && template.letterheadImagePath.startsWith("/uploads/")
            ? path.join(process.cwd(), "public", template.letterheadImagePath)
            : null,
      },
      qrDataUrl: qr,
    }),
  );

  return new Response(new Uint8Array(buffer), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename="${template.type.toLowerCase()}-preview.pdf"`,
      "cache-control": "no-store",
    },
  });
}
