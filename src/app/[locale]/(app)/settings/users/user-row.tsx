"use client";

import { useState, useTransition } from "react";
import type { User } from "@prisma/client";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  deactivateUser,
  reactivateUser,
  triggerPasswordResetFor,
} from "./actions";

export function UserRow({ user, isSelf }: { user: User; isSelf: boolean }) {
  const t = useTranslations("Settings");
  const [resetLink, setResetLink] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const handleReset = () => {
    startTransition(async () => {
      const res = await triggerPasswordResetFor(user.id);
      setResetLink(res.devInviteLink ?? null);
    });
  };

  const toggleActive = deactivateUser.bind(null, user.id);
  const reactivate = reactivateUser.bind(null, user.id);

  return (
    <tr>
      <td className="px-4 py-2">{user.name}</td>
      <td className="px-4 py-2">{user.email}</td>
      <td className="px-4 py-2">{user.role}</td>
      <td className="px-4 py-2">
        {user.deactivatedAt ? (
          <span className="rounded-full bg-neutral-200 px-2 py-0.5 text-xs">
            {t("fields.deactivated")}
          </span>
        ) : (
          <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-800">
            {t("fields.active")}
          </span>
        )}
      </td>
      <td className="px-4 py-2 text-neutral-600">
        {user.lastLoginAt
          ? user.lastLoginAt.toISOString().slice(0, 10)
          : t("fields.never")}
      </td>
      <td className="px-4 py-2 text-right">
        <div className="flex flex-wrap justify-end gap-2">
          {!isSelf && (
            <>
              <form action={user.deactivatedAt ? reactivate : toggleActive}>
                <Button type="submit" variant="ghost" size="sm">
                  {user.deactivatedAt
                    ? t("users.reactivate")
                    : t("users.deactivate")}
                </Button>
              </form>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={pending}
                onClick={handleReset}
              >
                {t("users.triggerReset")}
              </Button>
            </>
          )}
        </div>
        {resetLink && (
          <div className="mt-2 text-xs">
            <span className="text-neutral-500">{t("users.devInviteLink")}</span>
            <code className="mt-1 block break-all rounded bg-neutral-100 px-2 py-1">
              {resetLink}
            </code>
          </div>
        )}
      </td>
    </tr>
  );
}
