import { requireWorkspace } from "@/lib/session";
import { parseDateParam, rangeForView, type View } from "@/lib/calendar-dates";
import { loadCalendarItems } from "../load-items";
import { buildIcsCalendar, toIcsDate } from "@/lib/ics";

const VIEWS: View[] = ["month", "week", "day"];

export async function GET(req: Request) {
  const { workspace } = await requireWorkspace();
  const url = new URL(req.url);
  const view: View = VIEWS.includes(url.searchParams.get("view") as View)
    ? (url.searchParams.get("view") as View)
    : "month";
  const date = parseDateParam(url.searchParams.get("date") ?? undefined);
  const { start, end } = rangeForView(view, date);

  const items = await loadCalendarItems({ workspaceId: workspace.id, start, end });
  const body = buildIcsCalendar(items, { name: workspace.name });

  return new Response(body, {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": `attachment; filename="crm-calendar-${toIcsDate(start)}.ics"`,
    },
  });
}
