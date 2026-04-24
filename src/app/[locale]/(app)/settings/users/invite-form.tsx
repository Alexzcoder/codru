"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { inviteUser, type InviteState } from "./actions";

export function InviteForm() {
  const t = useTranslations("Settings.users");
  const [state, formAction, pending] = useActionState<InviteState, FormData>(
    inviteUser,
    {},
  );

  return (
    <form
      action={formAction}
      className="flex flex-wrap items-end gap-3 rounded-md border border-neutral-200 bg-white p-3"
    >
      <div className="space-y-1.5 flex-1 min-w-[240px]">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" required autoComplete="off" />
      </div>
      <Button type="submit" disabled={pending} size="sm">
        {t("invite")}
      </Button>
      {state.error === "alreadyMember" && (
        <p className="basis-full text-sm text-red-600">{t("alreadyMember")}</p>
      )}
      {state.sent && !state.devInviteLink && (
        <p className="basis-full text-sm text-green-700">{t("inviteSent")}</p>
      )}
      {state.devInviteLink && (
        <div className="basis-full text-sm text-neutral-800">
          <p className="text-xs text-neutral-500">{t("devInviteLink")}</p>
          <code className="mt-1 block break-all rounded bg-neutral-100 px-2 py-1">
            {state.devInviteLink}
          </code>
        </div>
      )}
    </form>
  );
}
