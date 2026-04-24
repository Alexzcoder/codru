import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { renderToBuffer } from "@react-pdf/renderer";
import { ReceiptPdf } from "@/lib/pdf/receipt-pdf";
import { clientDisplayName } from "@/lib/client-display";
import { notFound } from "next/navigation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireUser();
  const { id } = await params;

  const payment = await prisma.payment.findUnique({
    where: { id },
    include: {
      client: true,
      loggedBy: true,
      allocations: { include: { document: true } },
    },
  });
  if (!payment) notFound();

  // Pick a company profile — default or first.
  const company = await prisma.companyProfile.findFirst({
    where: { archivedAt: null },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
  });
  if (!company) notFound();

  const buffer = await renderToBuffer(
    ReceiptPdf({
      data: {
        locale: payment.client.defaultLanguage,
        paymentDate: payment.date,
        method: payment.method,
        amount: payment.amount.toString(),
        currency: payment.currency,
        reference: payment.reference,
        notes: payment.notes,
        company: {
          name: company.name,
          ico: company.ico,
          dic: company.dic,
          addressStreet: company.addressStreet,
          addressCity: company.addressCity,
          addressZip: company.addressZip,
        },
        client: {
          displayName: clientDisplayName(payment.client),
          ico: payment.client.ico,
          addressStreet: payment.client.addressStreet,
          addressCity: payment.client.addressCity,
          addressZip: payment.client.addressZip,
        },
        allocations: payment.allocations.map((a) => ({
          invoiceNumber: a.document.number,
          amount: a.amount.toString(),
        })),
        issuedByName: payment.loggedBy.name,
      },
      accent: company.brandColor,
    }),
  );

  return new Response(new Uint8Array(buffer), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename="receipt-${payment.date.toISOString().slice(0, 10)}.pdf"`,
      "cache-control": "no-store",
    },
  });
}
