import { prisma } from "@/lib/prisma";
import { Mail } from "lucide-react";

export async function EmailHistory({ documentId }: { documentId: string }) {
  const logs = await prisma.emailLog.findMany({
    where: { documentId },
    orderBy: { createdAt: "desc" },
    take: 10,
    include: { sentBy: { select: { name: true } } },
  });

  if (logs.length === 0) return null;

  return (
    <section className="mt-10">
      <h2 className="flex items-center gap-2 text-lg font-medium">
        <Mail size={16} /> Email history
      </h2>
      <ul className="mt-3 divide-y divide-border rounded-xl border border-border bg-card shadow-sm">
        {logs.map((l) => (
          <li key={l.id} className="px-4 py-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{l.subject}</p>
                <p className="text-xs text-muted-foreground">
                  to <span className="text-foreground">{l.toAddress}</span>
                  {" · "}from {l.fromAddress}
                  {l.draftedByClaude && " · drafted by Claude"}
                </p>
              </div>
              <div className="shrink-0 text-right text-xs text-muted-foreground">
                <div className="tabular-nums">
                  {l.createdAt.toISOString().slice(0, 16).replace("T", " ")}
                </div>
                <div>
                  <span
                    className={
                      l.status === "sent" || l.status === "delivered" || l.status === "opened"
                        ? "rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-800"
                        : l.status === "failed" || l.status === "bounced"
                          ? "rounded-full bg-red-100 px-2 py-0.5 text-red-800"
                          : "rounded-full bg-secondary px-2 py-0.5"
                    }
                  >
                    {l.status}
                  </span>
                </div>
              </div>
            </div>
            {l.errorMessage && (
              <p className="mt-1 text-xs text-red-700">{l.errorMessage}</p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
