import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { requireWorkspace } from "@/lib/session";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Token endpoint for client-direct receipt uploads (bulk expense import).
// Browsers upload receipt photos straight to Blob, so many/large images never
// pass through a server action body.
export async function POST(req: Request): Promise<NextResponse> {
  const body = (await req.json()) as HandleUploadBody;
  try {
    const { workspace } = await requireWorkspace();
    const json = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: [
          "image/jpeg",
          "image/png",
          "image/webp",
          "image/gif",
          "application/pdf",
        ],
        addRandomSuffix: true,
        maximumSizeInBytes: 15 * 1024 * 1024,
        tokenPayload: JSON.stringify({ workspaceId: workspace.id }),
      }),
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
