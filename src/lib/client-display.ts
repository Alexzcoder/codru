import type { Client } from "@prisma/client";

export function clientDisplayName(c: Pick<Client, "type" | "companyName" | "fullName" | "anonymizedAt">): string {
  if (c.anonymizedAt) return "[anonymized]";
  if (c.type === "COMPANY") return c.companyName ?? "(unnamed company)";
  return c.fullName ?? "(unnamed)";
}
