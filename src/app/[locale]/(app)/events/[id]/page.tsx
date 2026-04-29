import { setRequestLocale } from "next-intl/server";
import { requireWorkspace } from "@/lib/session";
import { hasFeature } from "@/lib/features";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { BackLink } from "@/components/back-link";
import { ConfirmButton } from "@/components/confirm-button";
import { deleteEvent } from "../actions";
import { deleteEventAttachment } from "./attachment-actions";
import { EventTodoList } from "./event-todo-list";
import { EventAttachmentUploader } from "./event-attachment-uploader";

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const { workspace } = await requireWorkspace();
  if (!hasFeature(workspace, "events")) notFound();

  const event = await prisma.event.findFirst({
    where: { id, workspaceId: workspace.id },
    include: {
      todos: {
        orderBy: [{ status: "asc" }, { position: "asc" }],
        include: {
          assignee: { select: { id: true, name: true } },
          attachments: {
            orderBy: { createdAt: "desc" },
            select: {
              id: true,
              filename: true,
              path: true,
              kind: true,
              caption: true,
            },
          },
        },
      },
      attachments: {
        orderBy: { createdAt: "desc" },
        include: { todo: { select: { id: true, title: true } } },
      },
    },
  });
  if (!event) notFound();

  // Workspace members are the assignable pool.
  const members = await prisma.user.findMany({
    where: {
      deactivatedAt: null,
      memberships: { some: { workspaceId: workspace.id } },
    },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const deleteBound = async () => {
    "use server";
    await deleteEvent(id);
  };

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <BackLink href="/events" label="Events" />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{event.name}</h1>
          <p className="mt-1 text-xs text-muted-foreground tabular-nums">
            {event.startDate.toISOString().slice(0, 10)}
            {event.endDate ? ` → ${event.endDate.toISOString().slice(0, 10)}` : ""}
            {event.location ? ` · ${event.location}` : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href={`/events/${id}/edit`}>
            <Button variant="outline" size="sm">
              Edit
            </Button>
          </Link>
          <form action={deleteBound}>
            <ConfirmButton
              label="Delete"
              message="The event, its to-dos, and uploaded files will be removed."
            />
          </form>
        </div>
      </div>

      {event.description && (
        <p className="mt-4 text-sm">{event.description}</p>
      )}

      <section className="mt-8">
        <h2 className="text-lg font-medium">To-dos</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Drag a card between columns to change its status. Files attached
          here also appear in the event Files list below.
        </p>
        <div className="mt-4">
          <EventTodoList
            eventId={id}
            todos={event.todos.map((t) => ({
              id: t.id,
              title: t.title,
              description: t.description,
              status: t.status,
              assigneeId: t.assigneeId,
              assigneeName: t.assignee?.name ?? null,
              dueDate: t.dueDate ? t.dueDate.toISOString().slice(0, 10) : null,
              attachments: t.attachments.map((a) => ({
                id: a.id,
                filename: a.filename,
                path: a.path,
                kind: a.kind as "IMAGE" | "PDF" | "OTHER",
                caption: a.caption,
              })),
            }))}
            assignees={members.map((m) => ({ id: m.id, name: m.name }))}
          />
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-medium">Files</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Images and PDFs (≤ 25 MB).
        </p>
        <div className="mt-3">
          <EventAttachmentUploader eventId={id} />
        </div>
        {event.attachments.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            No files yet.
          </p>
        ) : (
          <ul className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            {event.attachments.map((a) => {
              const delBound = async () => {
                "use server";
                await deleteEventAttachment(id, a.id);
              };
              return (
                <li
                  key={a.id}
                  className="overflow-hidden rounded-xl border border-border bg-card shadow-sm"
                >
                  {a.kind === "IMAGE" ? (
                    <a href={a.path} target="_blank" rel="noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={a.path}
                        alt={a.filename}
                        className="h-32 w-full object-cover"
                      />
                    </a>
                  ) : (
                    <a
                      href={a.path}
                      target="_blank"
                      rel="noreferrer"
                      className="flex h-32 items-center justify-center bg-secondary/40 text-sm"
                    >
                      📄 PDF
                    </a>
                  )}
                  <div className="p-2 text-xs">
                    <p className="truncate font-medium" title={a.filename}>
                      {a.filename}
                    </p>
                    {a.caption && (
                      <p className="text-muted-foreground">{a.caption}</p>
                    )}
                    {a.todo && (
                      <p className="mt-0.5 truncate text-[10px] uppercase tracking-wider text-muted-foreground">
                        from to-do · {a.todo.title}
                      </p>
                    )}
                    <form action={delBound} className="mt-2">
                      <button
                        type="submit"
                        className="cursor-pointer text-xs text-red-600 hover:underline"
                      >
                        Delete
                      </button>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {event.notes && (
        <section className="mt-10 rounded-xl border border-border bg-card shadow-sm p-5">
          <h2 className="text-sm font-medium text-muted-foreground">Notes</h2>
          <p className="mt-2 whitespace-pre-wrap text-sm">{event.notes}</p>
        </section>
      )}
    </div>
  );
}
