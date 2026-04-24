"use client";

import { useRouter } from "@/i18n/navigation";
import { useCallback } from "react";

// Makes an entire <tr> clickable while still letting nested <a>/<button>
// handle their own clicks (middle-click open-in-new-tab still works on them).
export function ClickableRow({
  href,
  className = "",
  children,
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
}) {
  const router = useRouter();

  const onClick = useCallback(
    (e: React.MouseEvent<HTMLTableRowElement>) => {
      // If the user clicked inside an anchor, button, label, or input, let
      // that element handle the event (checkboxes, inline links, bulk
      // actions, etc.).
      const target = e.target as HTMLElement;
      if (target.closest("a, button, input, label, textarea, select")) return;
      router.push(href);
    },
    [href, router],
  );

  return (
    <tr
      onClick={onClick}
      className={`cursor-pointer hover:bg-secondary/40 ${className}`}
    >
      {children}
    </tr>
  );
}
