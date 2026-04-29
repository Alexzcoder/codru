"use client";

import { useActionState, useTransition, useState } from "react";
import type { EventTodoStatus } from "@prisma/client";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import {
  addTodo,
  setTodoStatus,
  setTodoAssignee,
  deleteTodo,
  type AddTodoState,
} from "./todo-actions";

export type TodoRow = {
  id: string;
  title: string;
  description: string | null;
  status: EventTodoStatus;
  assigneeId: string | null;
  assigneeName: string | null;
  dueDate: string | null;
};

export type AssigneeOption = { id: string; name: string };

export function EventTodoList({
  eventId,
  todos,
  assignees,
}: {
  eventId: string;
  todos: TodoRow[];
  assignees: AssigneeOption[];
}) {
  const grouped: Record<EventTodoStatus, TodoRow[]> = {
    NOT_STARTED: todos.filter((t) => t.status === "NOT_STARTED"),
    IN_PROGRESS: todos.filter((t) => t.status === "IN_PROGRESS"),
    DONE: todos.filter((t) => t.status === "DONE"),
  };

  return (
    <div className="space-y-6">
      <AddForm eventId={eventId} assignees={assignees} />

      <div className="grid gap-4 md:grid-cols-3">
        <Column title="Not started" tone="bg-secondary" rows={grouped.NOT_STARTED} eventId={eventId} assignees={assignees} />
        <Column title="In progress" tone="bg-amber-100" rows={grouped.IN_PROGRESS} eventId={eventId} assignees={assignees} />
        <Column title="Done" tone="bg-green-100" rows={grouped.DONE} eventId={eventId} assignees={assignees} />
      </div>
    </div>
  );
}

function Column({
  title,
  tone,
  rows,
  eventId,
  assignees,
}: {
  title: string;
  tone: string;
  rows: TodoRow[];
  eventId: string;
  assignees: AssigneeOption[];
}) {
  return (
    <div className="rounded-xl border border-border bg-card shadow-sm">
      <div className={`flex items-center justify-between rounded-t-xl px-3 py-2 ${tone}`}>
        <span className="text-xs font-semibold uppercase tracking-wider">
          {title}
        </span>
        <span className="text-xs tabular-nums text-muted-foreground">
          {rows.length}
        </span>
      </div>
      {rows.length === 0 ? (
        <p className="px-3 py-4 text-xs text-muted-foreground">—</p>
      ) : (
        <ul className="divide-y divide-border">
          {rows.map((t) => (
            <TodoCard
              key={t.id}
              todo={t}
              eventId={eventId}
              assignees={assignees}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function TodoCard({
  todo,
  eventId,
  assignees,
}: {
  todo: TodoRow;
  eventId: string;
  assignees: AssigneeOption[];
}) {
  const [pending, startTransition] = useTransition();

  return (
    <li className="px-3 py-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{todo.title}</p>
          {todo.description && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              {todo.description}
            </p>
          )}
          <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
            {todo.dueDate && (
              <span className="tabular-nums">due {todo.dueDate}</span>
            )}
          </div>
        </div>
        <button
          type="button"
          aria-label="Delete to-do"
          className="shrink-0 cursor-pointer text-muted-foreground hover:text-red-600"
          onClick={() =>
            startTransition(async () => {
              await deleteTodo(eventId, todo.id);
            })
          }
          disabled={pending}
        >
          <Trash2 size={14} />
        </button>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <select
          value={todo.assigneeId ?? ""}
          onChange={(e) =>
            startTransition(async () => {
              await setTodoAssignee(eventId, todo.id, e.target.value);
            })
          }
          className="h-7 rounded-md border border-input bg-background px-1.5 text-xs"
        >
          <option value="">— unassigned —</option>
          {assignees.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        <StatusButtons
          eventId={eventId}
          todoId={todo.id}
          current={todo.status}
        />
      </div>
    </li>
  );
}

function StatusButtons({
  eventId,
  todoId,
  current,
}: {
  eventId: string;
  todoId: string;
  current: EventTodoStatus;
}) {
  const [pending, startTransition] = useTransition();
  const opts: { key: EventTodoStatus; label: string }[] = [
    { key: "NOT_STARTED", label: "Todo" },
    { key: "IN_PROGRESS", label: "In progress" },
    { key: "DONE", label: "Done" },
  ];
  return (
    <div className="inline-flex items-center rounded-md border border-input bg-background p-0.5 text-[11px]">
      {opts.map((o) => (
        <button
          key={o.key}
          type="button"
          disabled={pending || o.key === current}
          onClick={() =>
            startTransition(async () => {
              await setTodoStatus(eventId, todoId, o.key);
            })
          }
          className={`cursor-pointer rounded px-2 py-0.5 ${
            current === o.key
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function AddForm({
  eventId,
  assignees,
}: {
  eventId: string;
  assignees: AssigneeOption[];
}) {
  const [open, setOpen] = useState(false);
  const action = addTodo.bind(null, eventId);
  const [state, formAction, pending] = useActionState<AddTodoState, FormData>(
    action,
    {},
  );

  if (!open) {
    return (
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        + Add to-do
      </Button>
    );
  }

  return (
    <form
      action={async (fd) => {
        formAction(fd);
        // Close on success — relies on the action revalidating.
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
