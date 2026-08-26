"use client";

import { useActionState, useTransition, useState, useRef, useEffect } from "react";
import type { EventTodoStatus } from "@prisma/client";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Trash2, Paperclip, X as XIcon, GripVertical, Plus } from "lucide-react";
import {
  addTodo,
  setTodoStatus,
  setTodoAssignee,
  setTodoTeam,
  deleteTodo,
  type AddTodoState,
} from "./todo-actions";
import {
  uploadEventAttachment,
  deleteEventAttachment,
  type EventAttachmentState,
} from "./attachment-actions";

export type TodoAttachment = {
  id: string;
  filename: string;
  path: string;
  kind: "IMAGE" | "PDF" | "OTHER";
  caption: string | null;
};

export type TodoRow = {
  id: string;
  title: string;
  description: string | null;
  status: EventTodoStatus;
  assigneeId: string | null;
  assigneeName: string | null;
  teamId: string | null;
  dueDate: string | null;
  attachments: TodoAttachment[];
  // Set on cross-event boards (/tasks) so the card can say where it's from.
  eventId: string | null;
  eventName: string | null;
};

export type AssigneeOption = { id: string; name: string };
export type TeamOption = { id: string; name: string };

const STATUS_TONES: Record<EventTodoStatus, { header: string; ring: string; label: string }> = {
  NOT_STARTED: { header: "bg-secondary", ring: "ring-neutral-300", label: "Not started" },
  IN_PROGRESS: { header: "bg-amber-100", ring: "ring-amber-400", label: "In progress" },
  DONE: { header: "bg-green-100", ring: "ring-green-500", label: "Done" },
};

export function EventTodoList({
  eventId,
  todos,
  assignees,
  teams = [],
}: {
  // Null = standalone workspace board (/tasks); cards then link to their event.
  eventId: string | null;
  todos: TodoRow[];
  assignees: AssigneeOption[];
  teams?: TeamOption[];
}) {
  // Optimistic copy: dragging feels instant; the server action revalidates.
  const [items, setItems] = useState(todos);
  useEffect(() => setItems(todos), [todos]);

  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<EventTodoStatus | null>(null);
  const [, startTransition] = useTransition();

  const onDragStart = (id: string) => setDraggingId(id);
  const onDragEnd = () => {
    setDraggingId(null);
    setOverCol(null);
  };
  const onDropTo = (status: EventTodoStatus) => {
    if (!draggingId) return;
    const todo = items.find((t) => t.id === draggingId);
    if (!todo || todo.status === status) {
      setDraggingId(null);
      setOverCol(null);
      return;
    }
    setItems((prev) =>
      prev.map((t) => (t.id === draggingId ? { ...t, status } : t)),
    );
    startTransition(async () => {
      await setTodoStatus(draggingId, status);
    });
    setDraggingId(null);
    setOverCol(null);
  };

  const grouped: Record<EventTodoStatus, TodoRow[]> = {
    NOT_STARTED: items.filter((t) => t.status === "NOT_STARTED"),
    IN_PROGRESS: items.filter((t) => t.status === "IN_PROGRESS"),
    DONE: items.filter((t) => t.status === "DONE"),
  };

  return (
    <div className="space-y-6">
      <AddForm eventId={eventId} assignees={assignees} teams={teams} />

      <div className="grid gap-4 md:grid-cols-3">
        {(Object.keys(grouped) as EventTodoStatus[]).map((status) => (
          <Column
            key={status}
            status={status}
            rows={grouped[status]}
            showEventBadge={eventId === null}
            assignees={assignees}
            teams={teams}
            isDropTarget={overCol === status}
            draggingId={draggingId}
            onDragOver={(e) => {
              e.preventDefault();
              setOverCol(status);
            }}
            onDragLeave={() => setOverCol((s) => (s === status ? null : s))}
            onDrop={(e) => {
              e.preventDefault();
              onDropTo(status);
            }}
            onCardDragStart={onDragStart}
            onCardDragEnd={onDragEnd}
          />
        ))}
      </div>
    </div>
  );
}

function Column({
  status,
  rows,
  showEventBadge,
  assignees,
  teams,
  isDropTarget,
  draggingId,
  onDragOver,
  onDragLeave,
  onDrop,
  onCardDragStart,
  onCardDragEnd,
}: {
  status: EventTodoStatus;
  rows: TodoRow[];
  showEventBadge: boolean;
  assignees: AssigneeOption[];
  teams: TeamOption[];
  isDropTarget: boolean;
  draggingId: string | null;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onCardDragStart: (id: string) => void;
  onCardDragEnd: () => void;
}) {
  const tone = STATUS_TONES[status];
  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={`rounded-xl border bg-card shadow-sm transition-all ${
        isDropTarget ? `border-transparent ring-2 ${tone.ring}` : "border-border"
      }`}
    >
      <div className={`flex items-center justify-between rounded-t-xl px-3 py-2 ${tone.header}`}>
        <span className="text-xs font-semibold uppercase tracking-wider">
          {tone.label}
        </span>
        <span className="text-xs tabular-nums text-muted-foreground">
          {rows.length}
        </span>
      </div>
      {rows.length === 0 ? (
        <p className="px-3 py-6 text-center text-xs text-muted-foreground">
          {isDropTarget ? "Drop here" : "—"}
        </p>
      ) : (
        <ul className="space-y-2 p-2">
          {rows.map((t) => (
            <TodoCard
              key={t.id}
              todo={t}
              showEventBadge={showEventBadge}
              assignees={assignees}
              teams={teams}
              isDragging={draggingId === t.id}
              onDragStart={onCardDragStart}
              onDragEnd={onCardDragEnd}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function TodoCard({
  todo,
  showEventBadge,
  assignees,
  teams,
  isDragging,
  onDragStart,
  onDragEnd,
}: {
  todo: TodoRow;
  showEventBadge: boolean;
  assignees: AssigneeOption[];
  teams: TeamOption[];
  isDragging: boolean;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [showFiles, setShowFiles] = useState(false);

  return (
    <li
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", todo.id);
        onDragStart(todo.id);
      }}
      onDragEnd={onDragEnd}
      className={`group cursor-grab rounded-lg border border-border bg-background p-3 shadow-sm transition-opacity active:cursor-grabbing ${
        isDragging ? "opacity-40" : "hover:border-neutral-300"
      }`}
    >
      <div className="flex items-start gap-2">
        <GripVertical
          size={14}
          className="mt-0.5 shrink-0 text-muted-foreground/60"
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium leading-snug">{todo.title}</p>
          {showEventBadge && todo.eventId && todo.eventName && (
            <a
              href={`/events/${todo.eventId}`}
              className="mt-0.5 inline-block truncate text-[10px] uppercase tracking-wider text-muted-foreground hover:underline"
            >
              {todo.eventName}
            </a>
          )}
          {todo.description && (
            <p className="mt-1 text-xs text-muted-foreground">
              {todo.description}
            </p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <select
              value={todo.assigneeId ?? ""}
              onChange={(e) =>
                startTransition(async () => {
                  await setTodoAssignee(todo.id, e.target.value);
                })
              }
              className="h-6 rounded-full border border-input bg-background px-2 text-[11px]"
              aria-label="Assignee"
            >
              <option value="">— unassigned —</option>
              {assignees.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
            {teams.length > 0 && (
              <select
                value={todo.teamId ?? ""}
                onChange={(e) =>
                  startTransition(async () => {
                    await setTodoTeam(todo.id, e.target.value);
                  })
                }
                className="h-6 rounded-full border border-input bg-background px-2 text-[11px]"
                aria-label="Team"
              >
                <option value="">— no team —</option>
                {teams.map((tm) => (
                  <option key={tm.id} value={tm.id}>
                    {tm.name}
                  </option>
                ))}
              </select>
            )}
            {todo.dueDate && (
              <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] tabular-nums text-muted-foreground">
                due {todo.dueDate}
              </span>
            )}
            {todo.attachments.length > 0 && (
              <button
                type="button"
                onClick={() => setShowFiles((v) => !v)}
                className="inline-flex cursor-pointer items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[11px] hover:bg-neutral-200"
              >
                <Paperclip size={10} /> {todo.attachments.length}
              </button>
            )}
          </div>
        </div>
        <button
          type="button"
          aria-label="Delete to-do"
          className="shrink-0 cursor-pointer text-muted-foreground/70 opacity-0 transition-opacity hover:text-red-600 group-hover:opacity-100"
          onClick={() =>
            startTransition(async () => {
              await deleteTodo(todo.id);
            })
          }
          disabled={pending}
        >
          <Trash2 size={14} />
        </button>
      </div>

      {showFiles && todo.attachments.length > 0 && todo.eventId && (
        <ul className="mt-2 space-y-1 border-t border-border pt-2">
          {todo.attachments.map((a) => (
            <TodoAttachmentRow key={a.id} eventId={todo.eventId!} attachment={a} />
          ))}
        </ul>
      )}

      {/* ponytail: attachments hang off EventAttachment, so standalone tasks
          (no event) have none — add a workspace-level file model if needed. */}
      {todo.eventId && <TodoUploader eventId={todo.eventId} todoId={todo.id} />}
    </li>
  );
}

function TodoAttachmentRow({
  eventId,
  attachment,
}: {
  eventId: string;
  attachment: TodoAttachment;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <li className="flex items-center justify-between gap-2 text-[11px]">
      <a
        href={attachment.path}
        target="_blank"
        rel="noreferrer"
        className="inline-flex min-w-0 items-center gap-1 truncate hover:underline"
        title={attachment.filename}
      >
        {attachment.kind === "IMAGE" ? "🖼" : attachment.kind === "PDF" ? "📄" : "📎"}{" "}
        {attachment.filename}
      </a>
      <button
        type="button"
        onClick={() =>
          startTransition(async () => {
            await deleteEventAttachment(eventId, attachment.id);
          })
        }
        disabled={pending}
        aria-label="Remove file"
        className="cursor-pointer text-muted-foreground hover:text-red-600"
      >
        <XIcon size={11} />
      </button>
    </li>
  );
}

function TodoUploader({
  eventId,
  todoId,
}: {
  eventId: string;
  todoId: string;
}) {
  const bound = uploadEventAttachment.bind(null, eventId);
  const [state, formAction, pending] = useActionState<
    EventAttachmentState,
    FormData
  >(bound, {});
  const ref = useRef<HTMLFormElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!state.error && !pending) ref.current?.reset();
  }, [state, pending]);

  return (
    <form ref={ref} action={formAction} className="mt-2">
      <input type="hidden" name="todoId" value={todoId} />
      <input
        ref={fileRef}
        type="file"
        name="file"
        accept="image/png,image/jpeg,image/webp,application/pdf"
        className="hidden"
        onChange={() => ref.current?.requestSubmit()}
      />
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={pending}
        className="inline-flex cursor-pointer items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground disabled:opacity-50"
      >
        <Paperclip size={11} />
        {pending ? "Uploading…" : "Attach file"}
      </button>
      {state.error && (
        <span className="ml-2 text-[11px] text-red-600">{state.error}</span>
      )}
    </form>
  );
}

function AddForm({
  eventId,
  assignees,
  teams,
}: {
  eventId: string | null;
  assignees: AssigneeOption[];
  teams: TeamOption[];
}) {
  const [open, setOpen] = useState(false);
  const action = addTodo.bind(null, eventId);
  const [state, formAction, pending] = useActionState<AddTodoState, FormData>(
    action,
    {},
  );

  if (!open) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="gap-1.5"
      >
        <Plus size={14} /> Add to-do
      </Button>
    );
  }

  return (
    <form
      action={async (fd) => {
        formAction(fd);
        setOpen(false);
      }}
      className="space-y-3 rounded-xl border border-border bg-card p-4 shadow-sm"
    >
      <div className="space-y-1">
        <Label htmlFor="title">Title</Label>
        <Input id="title" name="title" required maxLength={200} />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="assigneeId">Assignee</Label>
          <select
            id="assigneeId"
            name="assigneeId"
            className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
            defaultValue=""
          >
            <option value="">— unassigned —</option>
            {assignees.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="dueDate">Due date</Label>
          <Input id="dueDate" name="dueDate" type="date" />
        </div>
        {teams.length > 0 && (
          <div className="space-y-1">
            <Label htmlFor="teamId">Team</Label>
            <select
              id="teamId"
              name="teamId"
              className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
              defaultValue=""
            >
              <option value="">— no team —</option>
              {teams.map((tm) => (
                <option key={tm.id} value={tm.id}>
                  {tm.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
      <div className="space-y-1">
        <Label htmlFor="description">Notes</Label>
        <textarea
          id="description"
          name="description"
          className="h-16 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Adding…" : "Add to-do"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setOpen(false)}
        >
          Cancel
        </Button>
        {state.error && (
          <span className="text-xs text-red-600">{state.error}</span>
        )}
      </div>
    </form>
  );
}
