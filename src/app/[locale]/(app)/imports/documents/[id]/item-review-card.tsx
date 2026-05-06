"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { approveImportItem, skipImportItem } from "../actions";

type Item = {
  id: string;
  filename: string;
  storedPath: string;
  status: string;
  parseError: string | null;
  parsed: Record<string, unknown> | null;
  matchedClient: {
    id: string;
    type: "INDIVIDUAL" | "COMPANY";
    companyName: string | null;
    fullName: string | null;
    ico: string | null;
    email: string | null;
  } | null;
  matchConfidence: number | null;
  costUsd: number;
  createdDocument: { id: string; type: string; number: string | null } | null;
};

type ClientOption = { id: string; label: string };

const TYPE_LABEL: Record<string, string> = {
  QUOTE: "Nabídka",
  ADVANCE_INVOICE: "Zálohová faktura",
  FINAL_INVOICE: "Faktura",
  CREDIT_NOTE: "Opravný daňový doklad",
  UNKNOWN: "Neznámý",
};

export function ItemReviewCard({
  item,
  clients,
}: {
  item: Item;
  clients: ClientOption[];
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [overrideClientId, setOverrideClientId] = useState<string>(
    item.matchedClient?.id ?? "",
  );

  const parsed = item.parsed as
    | (Record<string, unknown> & {
        documentType?: string;
        number?: string;
        issueDate?: string;
        dueDate?: string;
        currency?: string;
        totalGross?: number;
        clientName?: string;
        clientIco?: string;
        clientEmail?: string;
        notes?: string;
        confidence?: number;
        lineItems?: Array<{
          name: string;
          quantity?: number;
          unitPrice?: number;
          taxRatePercent?: number;
        }>;
      })
    | null;

  function handleApprove() {
    setError(null);
    if (!overrideClientId) {
      setError("Pick a client first.");
      return;
    }
    startTransition(async () => {
      const fd = new FormData();
      fd.set("clientId", overrideClientId);
      const res = await approveImportItem(item.id, fd);
      if (res.error) setError(res.error);
    });
  }

  function handleSkip() {
    setError(null);
    startTransition(async () => {
      const res = await skipImportItem(item.id);
      if (res.error) setError(res.error);
    });
  }

  const statusBadge = (() => {
    switch (item.status) {
      case "APPROVED":
        return <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-900">Approved</span>;
      case "SKIPPED":
        return <span className="rounded-full bg-neutral-200 px-2 py-0.5 text-xs text-neutral-700">Skipped</span>;
      case "FAILED":
        return <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-900">Failed</span>;
      case "PARSING":
        return <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-900">Parsing…</span>;
      default:
        return <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs text-yellow-900">Needs review</span>;
    }
  })();

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <a
              href={item.storedPath}
              target="_blank"
              rel="noreferrer"
              className="truncate text-sm font-medium hover:underline"
            >
              {item.filename}
            </a>
            {statusBadge}
          </div>
          <p className="text-[11px] text-muted-foreground">
            ${item.costUsd.toFixed(3)} parse cost
            {item.createdDocument && (
              <> · created Document {item.createdDocument.number ?? `(draft ${item.createdDocument.id.slice(-6)})`}</>
            )}
          </p>
        </div>
      </div>

      {item.status === "FAILED" && (
        <p className="mt-3 rounded-md bg-red-50 p-2 text-xs text-red-800">
          {item.parseError}
        </p>
      )}

      {parsed && (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-border bg-secondary/30 p-3 text-xs">
            <p className="font-semibold text-muted-foreground">AI extracted</p>
            <dl className="mt-2 space-y-1">
              <Row k="Type" v={TYPE_LABEL[parsed.documentType ?? "UNKNOWN"]} />
              <Row k="Number" v={parsed.number} />
              <Row k="Issue date" v={parsed.issueDate} />
              <Row k="Due date" v={parsed.dueDate} />
              <Row
                k="Total"
                v={parsed.totalGross != null ? `${parsed.totalGross} ${parsed.currency ?? ""}` : null}
              />
              <Row k="Client (extracted)" v={parsed.clientName} />
              <Row k="Client IČO" v={parsed.clientIco} />
              <Row k="Client email" v={parsed.clientEmail} />
              <Row
                k="Confidence"
                v={parsed.confidence != null ? `${(parsed.confidence * 100).toFixed(0)}%` : null}
              />
            </dl>
            {Array.isArray(parsed.lineItems) && parsed.lineItems.length > 0 && (
              <details className="mt-2">
                <summary className="cursor-pointer text-[11px] font-medium text-muted-foreground">
                  {parsed.lineItems.length} line item{parsed.lineItems.length === 1 ? "" : "s"}
                </summary>
                <ul className="mt-1 space-y-0.5 text-[11px]">
                  {parsed.lineItems.map((l, i) => (
                    <li key={i} className="text-muted-foreground">
                      • {l.name}{" "}
                      {l.quantity != null && l.unitPrice != null
                        ? `(${l.quantity} × ${l.unitPrice})`
                        : ""}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>

          <div className="rounded-lg border border-border p-3 text-xs">
            <p className="font-semibold text-muted-foreground">Match to client</p>
            {item.matchedClient ? (
              <p className="mt-2">
                Suggested:{" "}
                <span className="font-medium">
                  {item.matchedClient.companyName ?? item.matchedClient.fullName}
                </span>
                {item.matchConfidence != null && (
                  <span className="ml-1 text-muted-foreground">
                    ({(item.matchConfidence * 100).toFixed(0)}%)
                  </span>
                )}
              </p>
            ) : (
              <p className="mt-2 text-muted-foreground">No match — pick one below.</p>
            )}
            <select
              value={overrideClientId}
              onChange={(e) => setOverrideClientId(e.target.value)}
              disabled={item.status !== "PARSED" || pending}
              className="mt-2 h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
            >
              <option value="">— pick a client —</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>

            {item.status === "PARSED" && (
              <div className="mt-3 flex gap-2">
                <Button type="button" size="sm" onClick={handleApprove} disabled={pending}>
                  {pending ? "Saving…" : "Approve"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={handleSkip}
                  disabled={pending}
                >
                  Skip
                </Button>
              </div>
            )}
            {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string | number | null | undefined }) {
  return (
    <div className="flex gap-2">
      <dt className="w-28 shrink-0 text-muted-foreground">{k}:</dt>
      <dd className="min-w-0 break-words">{v ?? <span className="text-muted-foreground">—</span>}</dd>
    </div>
  );
}
