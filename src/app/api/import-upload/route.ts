import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { requireWorkspace } from "@/lib/session";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Token endpoint for client-direct PDF uploads (document import). Browsers upload
// straight to Vercel Blob, so large/many PDFs never pass through a server action
// body (which is capped and was crashing on >5 files). We only mint short-lived,
// scoped upload tokens for authenticated users.
export async function POST(req: Request): Promise<NextResponse> {
  const body = (await req.json()) as HandleUploadBody;

  try {
    const { workspace } = await requireWorkspace();

    const json = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: ["application/pdf"],
        addRandomSuffix: true,
        maximumSizeInBytes: 25 * 1024 * 1024, // 25 MB per PDF
        tokenPayload: JSON.stringify({ workspaceId: workspace.id }),
      }),
      // Fires via Vercel webhook after upload; nothing to persist here — the
      // client hands us the resulting blob URLs when it starts the session.
      onUploadCompleted: async () => {},
    });

    return NextResponse.json(json);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "upload failed" },
      { status: 400 },
    );
  }
}
