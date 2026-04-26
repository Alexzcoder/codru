"use client";

import { useState, useTransition, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, Bot, X } from "lucide-react";
import {
  suggestPriceForDescription,
  askClaudeForPrice,
  saveLineAsItemTemplate,
  type ContextLine,
} from "@/lib/pricing-history/actions";
import type { Suggestion } from "@/lib/pricing-history";
import type { AiEstimate } from "@/lib/pricing-history/ai-estimate";

type Stat = "median" | "low" | "high";

export type SitePhoto = {
  name: string;
  mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif";
  base64: string;
  previewUrl: string;
};

export type SuggesterTarget = {
  rowIndex: number; // 1-based for display
  description: string;
  contextLines: ContextLine[];
  photos?: SitePhoto[];
};

// ─────────────────────────────────────────────────────────────────────────────
// Trigger button — small, lives inside each row.
// ─────────────────────────────────────────────────────────────────────────────

export function PriceSuggesterButton({
  description,
  onOpen,
}: {
  description: string;
  onOpen: () => void;
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      className="h-7 gap-1 px-1.5 text-muted-foreground hover:text-foreground"
      onClick={onOpen}
      disabled={description.trim().length < 3}
      title="Suggest a price from your past quotes"
    >
      <Sparkles size={12} />
    </Button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Modal — rendered ONCE at parent level. Receives the active target.
// Lifting state up means there is no ambiguity about which row is being
// priced: the rowIndex is shown in the header and used by `onApply`.
// ─────────────────────────────────────────────────────────────────────────────

export function PriceSuggesterModal({
  target,
  onClose,
  onApply,
}: {
  target: SuggesterTarget | null;
  onClose: () => void;
  onApply: (rowIndex: number, unitPrice: string, unit: string | null) => void;
}) {
  const [data, setData] = useState<Suggestion | null>(null);
  const [ai, setAi] = useState<AiEstimate | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [aiPending, startAi] = useTransition();
  const [savePending, startSave] = useTransition();
  const [savedAs, setSavedAs] = useState<string | null>(null);
  const [selected, setSelected] = useState<Stat>("median");

  // (Re)fetch whenever the target changes.
  useEffect(() => {
    if (!target) {
      setData(null);
      setAi(null);
      setAiError(null);
      return;
    }
    setData(null);
    setAi(null);
    setAiError(null);
    setSavedAs(null);
    setSelected("median");
    const desc = target.description;
    const ctx = target.contextLines;
    startTransition(async () => {
      const r = await suggestPriceForDescription(desc, ctx);
      setData(r);
    });
  }, [target]);

  // Esc to close.
  useEffect(() => {
    if (!target) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [target, onClose]);

  if (!target) return null;

  const askAi = () => {
    setAiError(null);
    const desc = target.description;
    const ctx = target.contextLines;
    const imgs = (target.photos ?? []).map((p) => ({
      mediaType: p.mediaType,
      base64: p.base64,
    }));
    startAi(async () => {
      const r = await askClaudeForPrice(desc, ctx, imgs);
      if (r.ok) setAi(r.estimate);
      else setAiError(r.message);
    });
  };

  const apply = (price: number, unit: string | null) => {
    onApply(target.rowIndex, price.toFixed(2), unit);
    onClose();
  };

  const stats = data?.stats ?? null;
  const selectedPrice = stats
    ? selected === "median"
      ? stats.medianUnitPrice
      : selected === "low"
      ? stats.p25UnitPrice
      : stats.p75UnitPrice
    : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-xl border border-border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                Row {target.rowIndex}
              </span>
              <h3 className="text-base font-semibold">Suggested price</h3>
            </div>
            <p className="mt-1 text-xs text-muted-foreground line-clamp-1">
              For: <span className="text-foreground">{target.description}</span>
            </p>
            {target.contextLines.length > 0 && (
              <p className="mt-0.5 text-[10px] text-muted-foreground line-clamp-1">
                Context: {target.contextLines.map((l) => l.name).join(" · ")}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer text-muted-foreground hover:text-foreground"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body — two columns: history left, AI right */}
        <div className="grid gap-4 p-5 md:grid-cols-2">
          {/* History panel */}
          <section>
            <h4 className="text-xs uppercase tracking-wider text-muted-foreground">
              From your past quotes
            </h4>
            {pending && !data && (
              <p className="mt-3 text-sm text-muted-foreground">Searching…</p>
            )}
            {!pending && !stats && (
              <p className="mt-3 text-sm text-muted-foreground">
                No close past matches found.
              </p>
            )}
            {stats && (
              <>
                <div className="mt-2 rounded-md border border-border bg-secondary/40 p-3">
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs text-muted-foreground">
                      {selected === "median"
                        ? "Median"
                        : selected === "low"
                        ? "Low (P25)"
                        : "High (P75)"}
                    </span>
                    <span className="text-lg font-semibold tabular-nums">
                      {selectedPrice?.toLocaleString("cs-CZ", {
                        minimumFractionDigits: 2,
                      })}{" "}
                      Kč
                      {stats.detectedUnit ? `/${stats.detectedUnit}` : ""}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-baseline justify-between text-xs text-muted-foreground tabular-nums">
                    <span>Range (P25–P75)</span>
                    <span>
                      {stats.p25UnitPrice?.toFixed(0)} – {stats.p75UnitPrice?.toFixed(0)} Kč
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <StatPill
                      label="Low"
                      active={selected === "low"}
                      onClick={() => setSelected("low")}
                    />
                    <StatPill
                      label="Median"
                      active={selected === "median"}
                      onClick={() => setSelected("median")}
                    />
                    <StatPill
                      label="High"
                      active={selected === "high"}
                      onClick={() => setSelected("high")}
                    />
                    <Button
                      type="button"
                      size="sm"
                      className="ml-auto h-7 text-xs"
                      onClick={() => apply(selectedPrice ?? 0, stats.detectedUnit)}
                    >
                      Use {selected}
                    </Button>
                  </div>
                </div>

                <p className="mt-3 text-xs uppercase tracking-wider text-muted-foreground">
                  Similar lines ({data!.matches.length})
                </p>
                <ul className="mt-1 space-y-0.5 text-xs">
                  {data!.matches.slice(0, 6).map((m, i) => (
                    <li key={i}>
                      <button
                        type="button"
                        onClick={() => apply(m.unitPrice, m.unit || null)}
                        className="flex w-full items-start justify-between gap-2 rounded px-1.5 py-1 text-left hover:bg-secondary/40"
                      >
                        <span className="flex-1 truncate">{m.description}</span>
                        <span className="shrink-0 tabular-nums font-medium">
                          {m.unitPrice.toLocaleString("cs-CZ")} Kč
                          {m.unit ? `/${m.unit}` : ""}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>

          {/* AI panel */}
          <section>
            <h4 className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-emerald-700">
              <Bot size={12} /> AI estimate (Claude)
            </h4>

            {!ai && !aiPending && !aiError && (
              <div className="mt-2 rounded-md border border-dashed border-emerald-200 bg-emerald-50/40 p-3">
                <p className="text-xs text-emerald-900/80">
                  Best for new line types or as a sanity-check. Anchors on
                  your past prices, the other lines on this quote
                  {(target.photos?.length ?? 0) > 0
                    ? `, and ${target.photos!.length} attached photo${target.photos!.length === 1 ? "" : "s"}`
                    : ""}
                  .
                </p>
                <Button
                  type="button"
                  size="sm"
                  className="mt-2 h-7 bg-emerald-600 text-xs text-white hover:bg-emerald-700"
                  onClick={askAi}
                >
                  Ask Claude (≈ ${(target.photos?.length ?? 0) > 0 ? "0.02" : "0.005"})
                </Button>
              </div>
            )}

            {aiPending && (
              <div className="mt-2 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
                Thinking… (typically ~2–4 seconds)
              </div>
            )}

            {aiError && (
              <div className="mt-2 rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-800">
                {aiError}
              </div>
            )}

            {ai && (
              <div className="mt-2 rounded-md border border-emerald-200 bg-emerald-50 p-3">
                <div className="flex items-baseline justify-between">
                  <span className="rounded-full bg-emerald-200/70 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-emerald-900">
                    {ai.confidence} confidence
                  </span>
                  <span className="text-lg font-semibold tabular-nums text-emerald-900">
                    {ai.unitPrice.toLocaleString("cs-CZ", {
                      minimumFractionDigits: 2,
                    })}{" "}
                    Kč{ai.unit ? `/${ai.unit}` : ""}
                  </span>
                </div>
                <p className="mt-2 text-xs italic leading-relaxed text-emerald-900/80">
                  &ldquo;{ai.reasoning}&rdquo;
                </p>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <span className="text-[10px] text-emerald-900/60 tabular-nums">
                    ${ai.estimatedCostUsd.toFixed(4)} ·{" "}
                    {ai.inputTokens}+{ai.outputTokens} tokens
                  </span>
                  <div className="flex gap-1.5">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 border-emerald-300 text-xs text-emerald-800 hover:bg-emerald-100"
                      disabled={savePending || savedAs !== null}
                      onClick={() => {
                        const name = target.description.split(/\s+/).slice(0, 6).join(" ");
                        startSave(async () => {
                          const r = await saveLineAsItemTemplate({
                            name,
                            description: target.description,
                            unit: ai.unit,
                            unitPrice: ai.unitPrice,
                          });
                          if (r.ok) setSavedAs(name);
                          else setAiError(r.message);
                        });
                      }}
                    >
                      {savedAs ? `Memorised as “${savedAs}”` : savePending ? "Saving…" : "Memorise"}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      className="h-7 bg-emerald-600 text-xs text-white hover:bg-emerald-700"
                      onClick={() => apply(ai.unitPrice, ai.unit || null)}
                    >
                      Apply estimate
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function StatPill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`cursor-pointer rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-background text-muted-foreground hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );
}
