// Single source of truth for document status badge colour. Lists, detail
// pages and edit screens all import from here so the palette stays in sync.

import type { DocumentStatus } from "@prisma/client";

export function documentStatusClass(status: DocumentStatus | string): string {
  switch (status) {
    case "UNSENT":
      return "bg-secondary text-secondary-foreground";
    case "SENT":
      return "bg-blue-100 text-blue-800";
    case "ACCEPTED":
    case "PAID":
    case "APPLIED":
      return "bg-green-100 text-green-800";
    case "REJECTED":
    case "OVERDUE":
      return "bg-red-100 text-red-800";
    case "EXPIRED":
    case "PARTIALLY_PAID":
    case "PAID_PENDING_COMPLETION":
      return "bg-amber-100 text-amber-800";
    case "CANCELLED":
      return "bg-neutral-200 text-neutral-700 line-through";
    default:
      return "bg-secondary";
  }
}
