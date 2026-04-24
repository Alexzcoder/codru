"use client";

import { useActionState, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { addContactLog, type ContactLogState } from "./contact-actions";

export function ContactLogForm({ clientId, jobId }: { clientId: string; jobId?: string }) {
  const t = useTranslations("Clients");
  const tSet = useTranslations("Settings");
  const [state, formAction, pending] = useActionState<ContactLogState, FormData>(
    addContactLog,
    {},
  );
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.saved && !pending) ref.current?.reset();
  }, [state, pending]);

  return (
    <form
      ref={ref}
      action={formAction}
      className="space-y-3 rounded-md border border-neutral-200 bg-white p-4"
    >
      <input type="hidden" name="clientId" value={clientId} />
      {jobId && <input type="hidden" name="jobId" value={jobId} />}
      <div className="grid grid-cols-[200px_1fr] gap-3">
        <div className="space-y-2">
          <Label htmlFor="type">Type</Label>
          <select
            id="type"
            name="type"
            className="h-9 w-full rounded-md border border-neutral-300 bg-white px-2 text-sm"
            defaultValue="PHONE"
          >
            {(["PHONE", "EMAIL", "MEETING", "SITE_VISIT", "OTHER"] as const).map(
              (v) => (
                <option key={v} value={v}>
                  {t(`contactType.${v}`)}
                </option>
              ),
            )}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="notes">Notes</Label>
          <textarea
            id="notes"
            name="notes"
            required
            className="h-20 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
          />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending} size="sm">
          {t("detail.addContactLog")}
        </Button>
        {state.error && <span className="text-sm text-red-600">{state.error}</span>}
        {state.saved && <span className="text-sm text-green-700">{tSet("saved")}</span>}
      </div>
    </form>
  );
}
