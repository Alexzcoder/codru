import { prisma } from "@/lib/prisma";
import { loadCalendarItems } from "@/app/[locale]/(app)/calendar/load-items";
import { buildIcsCalendar } from "@/lib/ics";

// Public, UNAUTHENTICATED ICS subscription feed. The secret is the per-workspace
// `icsToken` in the path — calendar apps (Google/Apple) poll this URL on their
// own schedule, so it can't carry a login session. One-way: CRM → external
// calendar. Rotating the token (see feed-actions.ts) invalidates old links.
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  if (!token || token.length < 16) {
    return new Response("Not found", { status: 404 });
  }

  const workspace = await prisma.workspace.findUnique({
    where: { icsToken: token },
    select: { id: true, name: true, deletedAt: true },
  });
  if (!workspace || workspace.deletedAt) {
    return new Response("Not found", { status: 404 });
  }

  // Sliding window: recent past (so just-finished work is still visible) through
  // ~18 months ahead. Wide enough for planning, bounded so the feed stays small.
  const now = new Date();
  const start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  const end = new Date(now.getTime() + 540 * 24 * 60 * 60 * 1000);

  const items = await loadCalendarItems({ workspaceId: workspace.id, start, end });
  const body = buildIcsCalendar(items, { name: `${workspace.name} (Codru)` });

  return new Response(body, {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      // Let subscribers cache briefly; they poll infrequently anyway.
      "cache-control": "private, max-age=300",
    },
  });
}
