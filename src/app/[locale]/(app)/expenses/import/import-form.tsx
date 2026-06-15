"use client";

import { useState } from "react";
import { upload } from "@vercel/blob/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Link } from "@/i18n/navigation";
import { importReceiptAsExpense } from "./actions";

const fileInputCls =
  "h-9 w-full cursor-pointer rounded-md border border-input bg-background px-3 text-sm file:cursor-pointer outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

const MAX_FILES = 50;

type Row = {
  filename: string;
  status: "pending" | "uploading" | "scanning" | "done" | "error";
  supplier?: string | null;
  total?: string;
  date?: string;
  expenseId?: string;
  error?: string;
};

export function ReceiptImportForm({ locale }: { locale: string }) {
  const [files, setFiles] = useState<File[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);

  const tooMany = files.length > MAX_FILES;
  const doneCount = rows.filter((r) => r.status === "done").length;
  const errCount = rows.filter((r) => r.status === "error").length;

  async function run(e: React.FormEvent) {
    e.preventDefault();
    if (files.length === 0 || tooMany || busy) return;
    setBusy(true);
    const init: Row[] = files.map((f) => ({ filename: f.name, status: "pending" }));
    setRows(init);
    const patch = (i: number, p: Partial<Row>) =>
      setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...p } : r)));

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        patch(i, { status: "uploading" });
        const blob = await upload(`receipts/${file.name}`, file, {
          access: "public",
          handleUploadUrl: "/api/receipt-upload",
          contentType: file.type || "image/jpeg",
        });
        patch(i, { status: "scanning" });
        const res = await importReceiptAsExpense(blob.url, file.name);
        if (res.ok) {
          patch(i, {
            status: "done",
            supplier: res.supplier,
            total: res.total,
            date: res.date,
            expenseId: res.expenseId,
          });
        } else {
          patch(i, { status: "error", error: res.message });
        }
      } catch (err) {
        patch(i, { status: "error", error: err instanceof Error ? err.message : "failed" });
      }
    }
    setBusy(false);
  }

  return (
    <div className="space-y-5">
      {rows.length === 0 && (
        <form onSubmit={run} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="files">Účtenky (JPG / PNG)</Label>
            <input
              id="files"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              multiple
              className={fileInputCls}
              onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
            />
            {files.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {files.length} {files.length === 1 ? "soubor" : "souborů"} vybráno.
                {tooMany && <span className="text-red-600"> Max {MAX_FILES} najednou.</span>}
              </p>
            )}
          </div>
          <Button type="submit" disabled={files.length === 0 || tooMany}>
            Nahrát a zpracovat
          </Button>
        </form>
      )}

      {rows.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              Hotovo {doneCount}/{rows.length}
              {errCount > 0 && <span className="text-red-600"> · {errCount} chyb</span>}
            </span>
            {!busy && (
              <Link href="/expenses">
                <Button size="sm">Otevřít výdaje</Button>
              </Link>
            )}
          </div>
          <ul className="divide-y divide-border rounded-xl border border-border bg-card text-sm">
            {rows.map((r, i) => (
              <li key={i} className="flex items-center gap-3 px-3 py-2">
                <StatusDot status={r.status} />
                <span className="min-w-0 flex-1 truncate">{r.filename}</span>
                {r.status === "done" && (
                  <span className="shrink-0 text-muted-foreground">
                    {r.supplier ?? "—"} · {r.date} ·{" "}
                    <span className="tabular-nums">{r.total} Kč</span>
                  </span>
                )}
                {r.status === "error" && (
                  <span className="shrink-0 text-xs text-red-600">{r.error}</span>
                )}
                {(r.status === "uploading" || r.status === "scanning") && (
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {r.status === "uploading" ? "nahrávání…" : "čtení účtenky…"}
                  </span>
                )}
              </li>
            ))}
          </ul>
          {!busy && (
            <p className="text-xs text-muted-foreground">
              Výdaje byly vytvořeny. Otevřete je v seznamu a zkontrolujte částky,
              DPH a kategorii (předvyplněno automaticky).
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function StatusDot({ status }: { status: Row["status"] }) {
  const cls =
    status === "done"
      ? "bg-green-500"
      : status === "error"
        ? "bg-red-500"
        : status === "pending"
          ? "bg-neutral-300"
          : "bg-blue-500 animate-pulse";
  return <span className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${cls}`} />;
}
