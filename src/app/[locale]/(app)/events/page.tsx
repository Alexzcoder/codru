import { setRequestLocale } from "next-intl/server";
import { requireWorkspace } from "@/lib/session";
import { hasFeature } from "@/lib/features";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { ClickableRow } from "@/components/clickable-row";
import { Plus, Megaphone } from "lucide-react";

export default async function EventsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { workspace } = await requireWorkspace();
  if (!hasFeature(workspace, "events")) notFound();

  const events = await prisma.event.findMany({
    where: { workspaceId: workspace.id, archivedAt: null },
    orderBy: { startDate: "desc" },
    include: { _count: { select: { todos: true, attachments: true } } },
    take: 100,
  });

  return (
    <div className="mx-auto max-w-6xl px-8 py-8">
      <PageHeader
        title="Events"
        description={`${events.length} ${events.length === 1 ? "event" : "events"}`}
        actions={
          <Link href="/events/new">
            <Button size="sm" className="gap-1.5">
              <Plus size={14} /> New event
            </Button>
          </Link>
        }
      />

      {events.length === 0 ? (
        <div className="mt-12 rounded-xl border border-dashed border-border bg-card p-12 text-center shadow-sm">
          <Megaphone size={28} className="mx-auto text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">
            No events yet. Plan a speaker night, training, or social.
          </p>
          <Link href="/events/new" className="mt-4 inline-block">
            <Button size="sm">Create the first event</Button>
          </Link>
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-secondary/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left">Start</th>
                <th className="px-4 py-3 text-left">End</th>
                <th className="px-4 py-3 text-left">Location</th>
                <th className="px-4 py-3 text-right">To-dos</th>
                <th className="px-4 py-3 text-right">Files</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {events.map((e) => (
                <ClickableRow key={e.id} href={`/events/${e.id}`}>
                  <td className="px-4 py-3 font-medium">
                    <Link href={`/events/${e.id}`} className="hover:underline">
                      {e.name}
                    </Link>
                    {e.description && (
                      <div className="text-xs font-normal text-muted-foreground line-clamp-1">
                        {e.description}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground tabular-nums">
                    {e.startDate.toISOString().slice(0, 10)}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground tabular-nums">
                    {e.endDate ? e.endDate.toISOString().slice(0, 10) : "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {e.location ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {e._count.todos}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {e._count.attachments}
                  </td>
                </ClickableRow>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
