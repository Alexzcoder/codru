import { prisma } from "@/lib/prisma";
import { requireWorkspace } from "@/lib/session";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import {
  parseDateParam,
  toDateParam,
  addDays,
  addMonths,
  rangeForView,
  type View,
} from "@/lib/calendar-dates";
import { loadCalendarItems } from "./load-items";
import { MonthView } from "./month-view";
import { WeekView } from "./week-view";
import { DayView } from "./day-view";
import { AssigneeFilter } from "./assignee-filter";

const VIEWS: View[] = ["month", "week", "day"];

export default async function CalendarPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ view?: string; date?: string; assignee?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { workspace } = await requireWorkspace();
  const t = await getTranslations();
  const sp = await searchParams;

  const view: View = VIEWS.includes(sp.view as View) ? (sp.view as View) : "month";
  const date = parseDateParam(sp.date);
  const assigneeId = sp.assignee || undefined;

  const { start, end } = rangeForView(view, date);
  const [items, users] = await Promise.all([
    loadCalendarItems({ workspaceId: workspace.id, start, end, assigneeId }),
    prisma.user.findMany({
      where: { deactivatedAt: null, memberships: { some: { workspaceId: workspace.id } } },
      select: { id: true, name: true, calendarColor: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const prevDate =
    view === "month"
      ? addMonths(date, -1)
      : view === "week"
        ? addDays(date, -7)
        : addDays(date, -1);
  const nextDate =
    view === "month"
      ? addMonths(date, 1)
      : view === "week"
        ? addDays(date, 7)
        : addDays(date, 1);
  const today = new Date();
  const weekdayLabels = t.raw("Calendar.weekdays") as string[];

  const dateLabel = (() => {
    if (view === "day") return date.toLocaleDateString(locale, { dateStyle: "long" });
    if (view === "week") {
      const e = addDays(date, 6);
      return `${date.toLocaleDateString(locale, { day: "numeric", month: "short" })} — ${e.toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" })}`;
    }
    return date.toLocaleDateString(locale, { month: "long", year: "numeric" });
  })();

  const buildHref = (overrides: Partial<{ view: View; date: Date; assignee: string | undefined }>) => ({
    pathname: "/calendar",
    query: {
      view: overrides.view ?? view,
      date: toDateParam(overrides.date ?? date),
      ...((overrides.assignee !== undefined ? overrides.assignee : assigneeId) && {
        assignee: overrides.assignee !== undefined ? overrides.assignee : assigneeId,
      }),
    },
  });

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("Calendar.title")}
        </h1>
        <div className="flex gap-2">
          <Link href={`/calendar/export.ics?view=${view}&date=${toDateParam(date)}`} prefetch={false}>
            <Button variant="outline" size="sm">
              {t("Calendar.exportIcs")}
            </Button>
          </Link>
          <Link href="/calendar/new">
            <Button size="sm">{t("Calendar.newEvent")}</Button>
          </Link>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="flex overflow-hidden rounded-md border border-input text-sm">
          {VIEWS.map((v) => (
            <Link
              key={v}
              href={buildHref({ view: v })}
              className={
                v === view
                  ? "bg-primary px-3 py-1.5 text-white"
                  : "px-3 py-1.5 text-foreground hover:bg-secondary"
              }
            >
              {t(`Calendar.views.${v}`)}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-1">
          <Link href={buildHref({ date: prevDate })}>
            <Button variant="outline" size="sm">
              ‹
            </Button>
          </Link>
          <Link href={buildHref({ date: today })}>
            <Button variant="outline" size="sm">
              {t("Calendar.today")}
            </Button>
          </Link>
          <Link href={buildHref({ date: nextDate })}>
            <Button variant="outline" size="sm">
              ›
            </Button>
          </Link>
        </div>

        <p className="text-sm font-medium">{dateLabel}</p>

        <AssigneeFilter
          view={view}
          dateParam={toDateParam(date)}
          assigneeId={assigneeId}
          users={users.map((u) => ({ id: u.id, name: u.name }))}
        />
      </div>

      <div className="mt-6">
        {view === "month" && (
          <MonthView
            anchorDate={date}
            items={items}
            weekdays={weekdayLabels}
          />
        )}
        {view === "week" && (
          <WeekView anchorDate={date} items={items} weekdays={weekdayLabels} />
        )}
        {view === "day" && <DayView anchorDate={date} items={items} />}
      </div>
    </div>
  );
}
