"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { CreateSessionState } from "../actions";

const inputCls =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function NewSessionForm({
  action,
}: {
  action: (
    prev: CreateSessionState,
    formData: FormData,
  ) => Promise<CreateSessionState>;
}) {
  const [state, formAction, pending] = useActionState<CreateSessionState, FormData>(
    action,
    {},
  );
  const [files, setFiles] = useState<File[]>([]);

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="file">PDFs</Label>
        <input
          id="file"
          type="file"
          name="file"
          accept="application/pdf"
          multiple
          required
          onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
          className={inputCls}
        />
        {files.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {files.length} {files.length === 1 ? "file" : "files"} selected,{" "}
            {(files.reduce((s, f) => s + f.size, 0) / 1024 / 1024).toFixed(1)} MB
            total. Estimated cost ~${(files.length * 0.06).toFixed(2)} on Sonnet.
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="costCapUsd">Cost cap (USD)</Label>
        <input
          id="costCapUsd"
          name="costCapUsd"
          type="number"
          min={0.5}
          max={50}
          step={0.5}
          defaultValue={5}
          className={`${inputCls} w-32`}
        />
        <p className="text-[11px] text-muted-foreground">
          Parser stops once the running total crosses this. Default $5.
        </p>
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? "Parsing… (this may take a minute)" : "Start parsing"}
      </Button>

      {state.error && (
        <p className="text-sm text-red-600" role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}
